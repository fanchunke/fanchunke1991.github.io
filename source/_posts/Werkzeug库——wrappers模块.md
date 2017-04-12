---
title: Werkzeug库——wrappers模块
date: 2017-03-17 21:30:03
tags:
    - Flask
    - Werkzeug
    - Web编程
categories:
    - Flask
---


Werkzeug库中的`wrappers`模块主要对`request`和`response`进行封装。`request`包含了客户端发往服务器的所有请求信息，`response`包含了web应用返回给客户端的所有信息。`wrappers`模块对请求和响应的封装简化了客户端、服务器和web应用通信的流程。本文主要介绍`wrappers`模块中重要的类。

<!-- more -->

### `BaseRequest`

`BaseRequest`是一个非常基础的请求类，它可以和其他的“混合”类结合在一起构建复杂的请求类。只要传递一个环境变量`environ`（由`WSGI`服务器根据请求产生），便可以构造一个`BaseRequest`实例。其构造函数如下：

```Python
def __init__(self, environ, populate_request=True, shallow=False):
    self.environ = environ
    if populate_request and not shallow:
        self.environ['werkzeug.request'] = self
    self.shallow = shallow
```

初始化后，形成的实例`request`便具有了一些属性可以访问，这些属性只能以“只读”的方式访问。例如：

- url_charset
- want_form_data_parsed
- stream
- args
- data
- form
- values
- files
- cookies
- headers
- path
- full_path
- script_root
- url
- base_url
- url_root
- host_url
- host
- access_route
- remote_addr

`BaseRequest`中还有两个类方法比较常用：

**from_values(cls, *args, **kwargs)**

```Python
@classmethod
def from_values(cls, *args, **kwargs):
    """Create a new request object based on the values provided.  If
    environ is given missing values are filled from there.  This method is
    useful for small scripts when you need to simulate a request from an URL.
    Do not use this method for unittesting, there is a full featured client
    object (:class:`Client`) that allows to create multipart requests,
    support for cookies etc.

    This accepts the same options as the
    :class:`~werkzeug.test.EnvironBuilder`.

    .. versionchanged:: 0.5
       This method now accepts the same arguments as
       :class:`~werkzeug.test.EnvironBuilder`.  Because of this the
       `environ` parameter is now called `environ_overrides`.

    :return: request object
    """
    from werkzeug.test import EnvironBuilder
    charset = kwargs.pop('charset', cls.charset)
    kwargs['charset'] = charset
    builder = EnvironBuilder(*args, **kwargs)
    try:
        return builder.get_request(cls)
    finally:
        builder.close()
```

这个类方法可以根据提供的参数构建一个请求。

**application(cls, f)**

```Python
@classmethod
def application(cls, f):
    """Decorate a function as responder that accepts the request as first
    argument.  This works like the :func:`responder` decorator but the
    function is passed the request object as first argument and the
    request object will be closed automatically::

        @Request.application
        def my_wsgi_app(request):
            return Response('Hello World!')

    :param f: the WSGI callable to decorate
    :return: a new WSGI callable
    """
    #: return a callable that wraps the -2nd argument with the request
    #: and calls the function with all the arguments up to that one and
    #: the request.  The return value is then called with the latest
    #: two arguments.  This makes it possible to use this decorator for
    #: both methods and standalone WSGI functions.
    def application(*args):
        request = cls(args[-2])
        with request:
            return f(*args[:-2] + (request,))(*args[-2:])
    return update_wrapper(application, f)

```

这个类方法是一个装饰器，可以用来装饰`WSGI`可调用对象或函数。

以上属性和方法的具体用法可以参考[Request——werkzeug文档](http://werkzeug-docs-cn.readthedocs.io/zh_CN/latest/wrappers.html)。

### `BaseResponse`

`BaseResponse`类是一个响应类，用它可以封装一个`response`对象。`response`对象最大的特点是它是一个`WSGI`应用。

在之前介绍`WSGI`规范的文章中曾介绍过`Web服务器网关`，它简化了服务器和web应用之间的通信过程，它要求服务器和web应用要遵循`WSGI`规范进行开发。对于web应用而言，应用应该实现一个函数或者一个可调用对象，这样`WSGI`服务器可以通过调用`myWebApp(environ, start_response)`从web应用获得响应内容。

`response`响应对象就是这样一个`WSGI`应用对象。在其实现过程中有一个`__call__`方法，可以实现对一个`response`对象的调用。代码如下：

```Python
def __call__(self, environ, start_response):
    """Process this response as WSGI application.

    :param environ: the WSGI environment.
    :param start_response: the response callable provided by the WSGI
                           server.
    :return: an application iterator
    """
    app_iter, status, headers = self.get_wsgi_response(environ)
    start_response(status, headers)
    return app_iter

```

这样，我们就可以很清楚地理解`WSGI`应用的实现过程。下面是一个非常简单的`WSGI`应用。

```Python
from werkzeug.wrappers import Request, Response

def application(environ, start_response):
    request = Request(environ)
    response = Response("Hello %s!" % request.args.get('name', 'World!'))
    return response(environ, start_response)
```

上面的小例子的实现步骤分析：

1. 根据传入web应用的`environ`构造请求对象`request`；

2. web应用构造响应对象`response`；

3. 调用响应对象`response`。调用过程中产生三个值：`app_iter`、`status`、`headers`，其中`status`和`headers`作为参数传递给函数`start_response`用于生成响应报文首行的相关信息，而`app_iter`作为响应的内容（它是一个可迭代对象）返回给`WSGI网关`；

4. `WSGI网关`将返回的信息组成响应首行、响应首部、响应主体等，形成响应报文发回给客户端。

`BaseResponse`类中还有一些属性和方法，以下属性和方法的具体用法可以参考[Response——werkzeug文档](http://werkzeug-docs-cn.readthedocs.io/zh_CN/latest/wrappers.html)。

- 属性

    - status_code
    - status
    - data
    - is_stream
    - is_sequence
    - ······

- 方法

    - call_on_close(func)
    - close()
    - freeze()
    - force_type()  类方法
    - from_app()  类方法
    - set_data()
    - get_data()
    - `_ensure_sequence()`
    - make_sequence()
    - iter_encoded()
    - calculate_content_length()
    - set_cookie()
    - delete_cookie()
    - get_wsgi_headers(environ)
    - get_app_iter(environ)
    - get_wsgi_response(environ)
    - `__call__(environ, start_response)`
    - ······


### **Mixin类**

`BaseRequest`类和`BaseResponse`类是请求和响应最基础的类。`wrappers`模块中还提供了一些`Mixin`类，用于扩展请求类和响应类。

#### 有关请求类的`Mixin`类

有关请求类的`Mixin`类主要有：

- `AcceptMixin`类  ——请求报文中关于客户端希望接收的数据类型的类。

- `ETagRequestMixin`类  ——请求报文中关于Etag和Cache的类。

- `UserAgentMixin`类  ——请求报文中关于user_agent的类。

- `AuthorizationMixin`类  ——请求报文中关于认证的类。

- `CommonRequestDescriptorsMixin`类  ——通过这个类可以获取请求首部中的相关信息。

#### 有关响应类的`Mixin`类

有关响应类的`Mixin`类主要有：

- `ETagResponseMixin`类  ——为响应增加Etag和Cache控制的类。

- `ResponseStreamMixin`类  ——为响应可迭代对象提供一个“只写”的接口的类。

- `CommonResponseDescriptorsMixin`类  ——通过这个类可以获取响应首部中的相关信息。

- `WWWAuthenticateMixin`类  ——为响应提供认证的类。

### **Request**和**Response**

终于讲到`Request`类和`Response`类了。

`Request`类继承自`BaseRequest`类，并且结合一些请求相关的`Mixin`类，具体如下：

```Python
class Request(BaseRequest, AcceptMixin, ETagRequestMixin,
              UserAgentMixin, AuthorizationMixin,
              CommonRequestDescriptorsMixin)
```

`Response`类继承自`BaseResponse`类，并且结合一些响应相关的`Mixin`类，具体如下：

```Python
class Response(BaseResponse, ETagResponseMixin, ResponseStreamMixin,
               CommonResponseDescriptorsMixin,
               WWWAuthenticateMixin)
```

至此，可以从`wrappers`模块中引入`Request`类和`Response`用于构建请求对象和响应对象。
