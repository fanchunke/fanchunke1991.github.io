---
title: SocketServer——网络通信服务器
date: 2017-03-12 17:06:25
tags:
    - Python
    - 网络编程
categories:
    - Python
---

SocketServer是Python标准库中的一个模块，其作用是创建网络服务器。SocketServer模块定义了一些类来处理诸如TCP、UDP、UNIX流和UNIX数据报之上的同步网络请求。  

SocketServer模块处理网络请求的功能，可以通过两个主要的类来实现：一个是服务器类，一个是请求处理类。

- **服务器类** 处理通信问题，如监听一个套接字并接收连接等；
- **请求处理类** 处理“协议”问题，如解释到来的数据、处理数据并把数据发回给客户端等。

这种实现将服务器的实现过程和请求处理的实现过程解耦，这意味着我们可以将不同的服务器实现和请求处理实现结合起来来处理一些定制的协议，例如一个TCP服务器类和一个流请求处理类结合，处理基于TCP的网络请求。同时，也可以基于SocketServer模块中的服务器类和请求处理类，实现网络层之上应用层的服务器和请求处理实现，例如基于TCP服务器类实现HTTP服务器，基于流处理请求类实现HTTP请求处理类等。

<!-- more -->

### 服务器类

SocketServer模块中定义了五种服务器类。

- BaseServer(服务器的基类，定义了API)
- TCPServer(使用TCP/IP套接字)
- UDPServer(使用数据报套接字)
- UnixStreamServer(使用UNIX域套接字，只适用UNIX平台)
- UnixDatagramServer(使用UNIX域套接字，只适用UNIX平台)

#### 1. 构造服务器对象

要构建一个服务器对象，需要向它传递一个地址`server_address`（服务器将在这个地址上监听请求），以及一个请求处理类`RequestHandlerClass`（不是请求处理实例）。服务器类基类的构造函数如下：

```Python
class BaseServer:

    def __init__(self, server_address, RequestHandlerClass):
        """Constructor.  May be extended, do not override."""
        self.server_address = server_address
        self.RequestHandlerClass = RequestHandlerClass
        self.__is_shut_down = threading.Event()
        self.__shutdown_request = False

```

之后，可以构造TCPServer、UDPServer、UnixStreamServer、UnixDatagramServer。其中，TCPServer继承自BaseServer，UDPServer和UnixStreamServer继承自TCPServer，UnixDatagramServer继承自UDPServer。各个服务器类型可以根据自己的特点对基类进行扩展，例如创建监听套接字、绑定监听地址和端口、进行监听等。一旦实例化服务器对象，便可以使用服务器的方法来监听和处理请求。

#### 2. 实现服务器

由于SocketServer模块中定义的五种服务器类中，除了基类BaseServer和TCPServer外，其余的三个类都是直接或间接地继承自TCPServer。因此，以下以TCPServer的实现过程为例进行说明。

- **构造TCPServer**。  构造TCPServer时，构造函数创建了一个套接字（这个套接字可以通过更改地址簇和类型用于其他服务器）用于监听请求。并且调用`server_bind()`绑定监听的地址和端口，调用`server_activate()`开始监听。

- **启动服务器**。 服务器实例化后，可以使用`serve_forever()`或者`handle_request()`来监听和处理请求，实现服务器功能。这两个方法的具体实现依赖于`_handle_request_noblock()`方法。这个方法是BaseServer类中定义的。具体实现如下：

```Python
def _handle_request_noblock(self):
    """Handle one request, without blocking.

    I assume that select.select has returned that the socket is
    readable before this function was called, so there should be
    no risk of blocking in get_request().
    """
    try:
        request, client_address = self.get_request()
    except socket.error:
        return
    if self.verify_request(request, client_address):
        try:
            self.process_request(request, client_address)
        except:
            self.handle_error(request, client_address)
            self.shutdown_request(request)
    else:
        self.shutdown_request(request)
```

- **处理请求**。 根据上一步骤启动服务器后，服务器便开始监听请求。如果接收到请求信息，便开始处理请求。由`_handle_request_noblock()`可以看出有几个函数比较重要。

    - `get_request()` ——这个函数可以在子类中重写。在TCPServer中，该函数调用监听套接字的`accept()`方法，返回请求`request`和客户端地址`client_address`。

    - `verify_request(request, client_address)` ——这个函数可以在子类中重写。该函数返回True表示处理请求，返回False表示忽略请求。

    - `process_request(request, client_address)` ——这个函数可以在子类中重写。该函数将调用`finish_request()`具体完成请求的处理过程，并且在处理完请求后关闭请求。

    - `finish_request(request, client_address)` ——该函数将构造一个请求处理类的实例。请求处理类被实例化后将调用其`handle()`方法处理请求。

#### 3. 进程/线程支持

SocketServer模块中还提供了一些"mix-in"类：`ForkingMixIn`和`ThreadingMixIn`。这些类可以和服务器类混合使用，很容易改变服务器，为每个请求使用一个单独的进程或线程。具体的服务器类有：

- `class ForkingUDPServer(ForkingMixIn, UDPServer)`

- `class ForkingTCPServer(ForkingMixIn, TCPServer)`

- `class ThreadingUDPServer(ThreadingMixIn, UDPServer)`

- `class ThreadingTCPServer(ThreadingMixIn, TCPServer)`

- `class ThreadingUnixStreamServer(ThreadingMixIn, UnixStreamServer)`

- `class ThreadingUnixDatagramServer(ThreadingMixIn, UnixDatagramServer)`

### 请求处理类

要接收到来的请求以及确定采取什么行动，其中大部分的工作都是由请求处理类完成的。请求处理类负责在套接字层之上实现协议。具体过程为：读取请求、处理请求、写回响应。请求处理类基类中定义了3个方法，子类中需要重写。

- `setup()` ——为请求准备请求处理器

- `handle()` ——对请求完成具体的工作。诸如解析到来的请求，处理数据，并发回响应等。

- `finish()` ——清理`setup()`期间创建的所有数据
