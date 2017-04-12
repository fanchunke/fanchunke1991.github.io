---
title: BaseHTTPServer——实现Web服务器
date: 2017-03-12 20:43:05
tags:
    - Python
    - 网络编程
categories:
    - Python
---


在{% post_link SocketServer——网络通信服务器 SocketServer——网络通信服务器 %}中我们介绍了Python标准库中的SocketServer模块，了解了要实现网络通信服务，就要构建一个服务器类和请求处理类。同时，该模块还为我们创建了不同的服务器类和请求处理类。

<!--more-->

- 服务器类

    - `BaseServer`

    - `TCPServer(BaseServer)`

    - `UDPServer(TCPServer)`

    - `UnixStreamServer`

    - `UnixDatagramServer`

- 请求处理类

    - `BaseRequestHandler`

    - `StreamRequestHandler(BaseRequestHandler)`

    - `DatagramRequestHandler(BaseRequestHandler)`

通过服务器类和请求处理类的搭配，我们可以创建不同类型的服务器，实现不同的协议类型。本文介绍的BaseHTTPServer模块便是继承TCPServer和StreamRequestHandler，实现了Web服务器的通信。

### HTTP服务器

HTTP服务器继承自SocketServer模块中的`TCPServer`类。它的定义非常简单，只是重写了其中的一个方法。

```Python
class HTTPServer(SocketServer.TCPServer):

    allow_reuse_address = 1    # Seems to make sense in testing environment

    def server_bind(self):
        """Override server_bind to store the server name."""
        SocketServer.TCPServer.server_bind(self)
        host, port = self.socket.getsockname()[:2]
        self.server_name = socket.getfqdn(host)
        self.server_port = port
```

重写的`server_bind()`方法主要是为了获取服务器名和端口。其余方法以及服务器的实现过程详见{% post_link SocketServer——网络通信服务器 SocketServer——网络通信服务器 %}。

此外，还可以从SocketServer模块中引入'mix-in'类，基于`HTTPServer`创建支持进程或线程的服务器。

### HTTP请求处理基类

为了处理HTTP请求，BaseHTTPServer模块构造了HTTP请求处理基类`BaseHTTPRequestHandler`，它继承自SocketServer模块中的`StreamRequestHandler`类。

HTTP请求处理基类中有一些重要的方法：

- **handle()**  ——这个方法是请求处理类真正处理请求具体工作的方法，例如解析到来的请求，处理数据，并发回响应等。在`BaseHTTPRequestHandler`中它是一个入口文件，将调用其他的方法完成请求处理。

- **handle_one_request()**  ——由`handle()`调用，用于处理请求。其主要工作包括：

    1. 调用`parse_request()`方法，解析请求，获取请求报文中的信息，包括请求的方法、请求URL、请求的HTTP版本号、请求首部等。如果解析失败，则调用`send_error()`方法发回一个错误响应。

    2. 调用`do_SPAM()` 方法。这个方法中的`SPAM`指代`GET`、`POST`、`HEAD`等请求方法，需要在请求处理类中构建具体的请求处理方法，例如`do_GET`处理`GET`请求，`do_POST`处理`POST`请求。`do_SPAM()` 方法可以调用`send_response()`、`send_header()`、`end_headers()`等方法创建响应首行和响应首部等内容。

- **parse_request()**  ——解析请求。

- **send_error()**  ——发回错误响应。

- **send_response()**  ——创建响应首行和响应首部等内容。

- **send_header()**  ——设置响应首部内容。

- **end_headers()**  ——调用此方法可以在首部后增加一个空行，表示首部内容结束（不适用于HTTP/0.9）

- 还包括其他的一些辅助函数。

需要注意的是：`BaseHTTPRequestHandler`是HTTP请求处理的基类，并不包含诸如`do_GET`、`do_POST`等方法，其他继承该类的请求处理类需要自己实现这些方法，已完成对具体请求的处理。对此，可以参考`SimpleHTTPServer`模块，也可查看文章{% post_link SimpleHTTPServer——一个简单的HTTP服务器 SimpleHTTPServer——一个简单的HTTP服务器 %}。
