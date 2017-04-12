---
title: SimpleHTTPServer——一个简单的HTTP服务器
date: 2017-03-13 21:02:18
tags:
    - Python
    - 网络编程
categories:
    - Python
---


Python标准库中的`BaseHTTPServer`模块实现了一个基础的HTTP服务器基类和HTTP请求处理类。这在文章{% post_link BaseHTTPServer——实现Web服务器 BaseHTTPServer——实现Web服务器 %}中进行了相关的介绍。然而，`BaseHTTPServer`模块中并没有定义相关的请求方法，诸如`GET`、`HEAD`、`POST`等。在`BaseHTTPServer`模块的基础上，Python标准库中的`SimpleHTTPServer`模块实现了简单的`GET`、`HEAD`请求。

在该模块中，它沿用了`BaseHTTPServer`模块中实现的`HTTPServer`服务器，这里就不再赘述。而请求处理类则是继承了`BaseHTTPServer`模块中的`BaseHTTPRequestHandler`类。`SimpleHTTPServer`模块实现了具有`GET`、`HEAD`请求方法的HTTP通信服务。根据文章{% post_link BaseHTTPServer——实现Web服务器 BaseHTTPServer——实现Web服务器 %}中的介绍，只需要在请求处理类中定义`do_GET()`和`do_HEAD()`方法即可。

<!-- more -->

### **`do_GET()`**

`do_GET()`方法的源码如下：

```Python
def do_GET(self):
    """Serve a GET request."""
    f = self.send_head()
    if f:
        try:
            self.copyfile(f, self.wfile)
        finally:
            f.close()
```

在这个方法中，它调用了`send_head()`方法来返回一个响应。`send_head()`方法会调用`send_response()`、`send_header()`、`send_error()`方法等设置响应报文等。

### **`do_HEAD()`**

`do_HEAD()`方法的源码如下：

```Python
def do_HEAD(self):
    """Serve a HEAD request."""
    f = self.send_head()
    if f:
        f.close()
```

`do_HEAD()`方法和`do_GET()`方法的实现类似。

### 测试例子

`SimpleHTTPServer`模块还提供了一个测试函数。只需要在命令行中运行如下代码：

```Python
python SimpleHTTPServer.py  # SimpleHTTPServer.py指代Python标准库中的SimpleHTTPServer模块，注意文件位置。

```

如果在本地环境中运行以上代码，将会调用请求处理类的`translate_path`和`list_directory`方法展示一个文件目录。

然后在浏览器中访问`127.0.0.1:8000`即可查看`SimpleHTTPServer.py`文件所在目录下的所有文件。
