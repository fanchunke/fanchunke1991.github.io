---
title: wsgiref包——符合WSGI标准的Web服务实现（一）
date: 2017-03-14 21:05:52
tags:
    - Python
    - 网络编程
categories:
    - Python
---


### 引子

在前几篇文章：{% post_link SocketServer——网络通信服务器 SocketServer——网络通信服务器 %}、{% post_link BaseHTTPServer——实现Web服务器 BaseHTTPServer——实现Web服务器 %}、{% post_link SimpleHTTPServer——一个简单的HTTP服务器 SimpleHTTPServer——一个简单的HTTP服务器 %}，我们介绍了Python标准库对于网络通信的支持，并且还介绍了标准库中的一些模块，例如`TCPServer`、`UDPServer`、`BaseHTTPServer`等。这些模块能够实现基础的网路通信服务，例如TCP/UDP层的通信、HTTP应用层的通信。

<!-- more -->

上述模块对于网络通信的实现，基本的流程是：

- 创建一个服务器。例如TCP服务器、UDP服务器、HTTP服务器。服务器可以监听和接收请求；

- 创建请求处理程序。请求处理程序可以解析到达的请求，并发回一个响应。

以上流程基本上反映了Python标准库中关于网络通信的基本过程。服务器类和请求处理类的解耦，意味着很多应用可以使用某个现有的服务器类，而不需要其他任何的修改，只需要提供一个可以处理这些应用的请求处理类即可。但随着近些年网络编程越来越复杂，对于服务器网络通信提出了较大的挑战。以Web编程为例，挑战主要在于：

1. 服务器不再仅仅提供简单的、静态的HTML页面，更多的是要与丰富的Web应用进行相互通信。如果将请求处理程序的构建放在服务器端实现，那对于每个Web应用构建一个请求处理程序显然不现实；

2. 如果将请求处理程序的构建放在开发Web应用的过程中，那无疑增加了Web应用程序开发的难度和复杂度，也是不太理想的。

为了解决这些问题，常用的做法是提供一个中间层，通常称为`网关接口`。`网关接口`在服务器和应用中间承担一个`“翻译官”`的角色。只要应用程序符合网关接口的标准，那么服务器就只要做好服务器的角色，应用程序只要做好应用程序的作用，服务器和应用程序之间的通信全靠`网关接口`来协调。常用的网关接口有`CGI`、`WSGI`，本文就以`WSGI网关接口`来对此进行说明。

### WSGI网关接口

`WSGI` (Python Web Server Gateway Interface, Python Web服务器网关接口)是一个Web服务器和Web应用程序之间的标准化接口，用于增进应用程序在不同的Web服务器和框架之间的可移植性。关于该标准的官方说明可以参考[PEP333](http://www.python.org/dev/peps/pep-0333)。

`WSGI`的主要作用是在Web服务器和Web应用程序承担`“翻译官”`的角色。对于这一角色可以这样理解：

1. Web服务器的责任在于监听和接收请求。在处理请求的时候调用`WSGI`提供的标准化接口，将请求的信息转给`WSGI`；

2. `WSGI`的责任在于“中转”请求和响应信息。`WSGI`接收到Web服务器提供的请求信息后可以做一些处理，之后通过标准化接口调用Web应用，并将请求信息传递给Web应用。同时，`WSGI`还将会处理Web应用返回的响应信息，并通过服务器返回给客户端；

3. Web应用的责任在于接收请求信息，并且生成响应。

根据以上分析，要实现符合`WSGI`标准的Web服务，服务器和应用程序的设计就要符合`WSGI`规范。

### WSGI规范

`WSGI`规范如下：

- 服务器的请求处理程序中要调用符合`WSGI`规范的网关接口；

- 网关接口调用应用程序，并且要定义`start_response(status, headers)`函数，用于返回响应；

- 应用程序中实现一个函数或者一个可调用对象`webapp(environ,  start_response)`。其中`environ`是环境设置的字典，由服务器和`WSGI网关接口`设置，`start_response`是由网关接口定义的函数。

在Python标准库中，`wsgiref`包就是符合`WSGI`标准的Web服务实现。后面简单对`wsgiref`包进行介绍，以此来对符合`WSGI`标准的Web服务的实现过程进行梳理。

### wsgiref包

`wsgiref`包为实现`WSGI`标准提供了一个参考，它可以作为独立的服务器测试和调试应用程序。在实际的生产环境中尽量不要使用。`wsgiref`包含有以下模块：

- **`simple_server`模块**  ——`simple_server`模块实现了可以运行单个`WSGI`应用的简单的HTTP服务器。

- **`headers`模块**  ——管理响应首部的模块。

- **`handlers`模块**  ——符合`WSGI`标准的Web服务网关接口实现。该模块包含了一些处理程序对象，用来设置`WSGI`执行环境，以便应用程序能够在其他的Web服务器中运行。

- **`validate`模块**  ——“验证包装”模块，确保应用程序和服务器都能够按照`WSGI`标准进行操作。

- **`util`模块**  ——一些有用的工具集。

以上模块暂时不做详细的介绍。本文剩余内容将`simple_server`模块单独拿出来，以其中的测试例子简单说明符合`WSGI`标准的Web服务器的实现过程。

### simple_server——一个简单的符合`WSGI`规范的服务器

`wsgiref`包的`simple_server`模块实现了一个符合`WSGI`规范的服务器。测试代码如下：

```Python
if __name__ == '__main__':
    httpd = make_server('', 8000, demo_app)
    sa = httpd.socket.getsockname()
    print "Serving HTTP on", sa[0], "port", sa[1], "..."
    import webbrowser
    webbrowser.open('http://localhost:8000/xyz?abc')
    httpd.handle_request()  # serve one request, then exit
    httpd.server_close()

```

#### 1. 创建HTTP服务器

上述测试代码中`httpd = make_server('', 8000, demo_app)`创建了一个HTTP服务器。

其中`make_server`函数用来创建服务器：

```Python
def make_server(
    host, port, app, server_class=WSGIServer, handler_class=WSGIRequestHandler
):
    """Create a new WSGI server listening on `host` and `port` for `app`"""
    server = server_class((host, port), handler_class)
    server.set_app(app)
    return server
```

`make_server`函数使用`WSGIServer`类构建符合`WSGI`规范的HTTP服务器，使用`WSGIRequestHandler`类作为处理请求的类，使用`demo_app`作为一个Web应用。该函数返回一个服务器实例，并开始监听请求。可以通过`httpd.socket.getsockname()`获取服务器地址和端口号。

#### 2. 使用`webbrowser`模块创建请求

紧接着，测试例子导入`webbrowser`模块，使用函数创建了一个请求。

```Python
webbrowser.open('http://localhost:8000/xyz?abc')
```

#### 3. 服务器处理请求

服务器通过`handle_request()`方法处理请求。关于处理请求的过程简单介绍如下：

- `handle_request()`方法通过调用`get_request`、`verify_request`、`process_request`、`finish_request`等方法创建一个请求处理实例（该过程可以参考TCPServer、HTTPServer的实现过程）；

- 请求处理实例调用`handle()`方法处理请求。`handle()`在`WSGIRequestHandler`类中进行了重写。代码如下：

```Python
def handle(self):
    """Handle a single HTTP request"""

    self.raw_requestline = self.rfile.readline(65537)
    if len(self.raw_requestline) > 65536:
        self.requestline = ''
        self.request_version = ''
        self.command = ''
        self.send_error(414)
        return

    if not self.parse_request(): # An error code has been sent, just exit
        return

    handler = ServerHandler(
        self.rfile, self.wfile, self.get_stderr(), self.get_environ()
    )
    handler.request_handler = self      # backpointer for logging
    handler.run(self.server.get_app())

```

上面`handle()`函数先解析了请求，之后创建了一个`WSGI`网关类实例`handler`，这个实例可以作为服务器和应用程序之间的接口存在。

#### 4. `WSGI`网关的请求处理过程

`WSGI`网关的定义在`handlers`模块。上一步骤中通过调用`WSGI`网关类实例`handler`的`run`方法，`WSGI`网关开始处理请求。

`run`方法的代码如下：

```Python
def run(self, application):
    """Invoke the application"""
    # Note to self: don't move the close()!  Asynchronous servers shouldn't
    # call close() from finish_response(), so if you close() anywhere but
    # the double-error branch here, you'll break asynchronous servers by
    # prematurely closing.  Async servers must return from 'run()' without
    # closing if there might still be output to iterate over.
    try:
        self.setup_environ()
        self.result = application(self.environ, self.start_response)
        self.finish_response()
    except:
        try:
            self.handle_error()
        except:
            # If we get an error handling an error, just give up already!
            self.close()
            raise   # ...and let the actual server figure it out.

```

`run`方法的主要功能有：

- 通过`setup_environ()`方法创建`WSGI`相关的环境；

- 调用`WSGI`应用的函数或者`WSGI`应用的可调用对象。本测试例子中的`WSGI`应用是一个简单的函数，其作用是将请求的`environ`信息打印出来。

- 调用`finish_response()`方法将`WSGI`应用返回的数据作为响应发回。

#### 5. 关闭服务器

请求结束后，服务器会调用一系列函数关闭请求连接。之后测试代码调用`server_close()`方法关闭服务器。
