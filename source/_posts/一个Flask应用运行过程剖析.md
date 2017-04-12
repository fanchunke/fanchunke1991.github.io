---
title: 一个Flask应用运行过程剖析
date: 2017-03-23 21:45:30
tags:
    - Flask
    - Web编程
categories:
    - Flask
---


相信很多初学Flask的同学（包括我自己），在阅读官方文档或者Flask的学习资料时，对于它的认识是从以下的一段代码开始的：

```Python
from flask import Flask

app = Flask(__name__)

@app.route('/')
def index():
    return "Hello World!"

if __name__ == '__main__':
    app.run()
```

<!-- more -->

运行如上代码，在浏览器中访问`http://localhost:5000/`，便可以看到`Hello World!`出现了。这是一个很简单的Flask的应用。

然而，这段代码怎么运行起来的呢？一个Flask应用运转的背后又有哪些逻辑呢？如果你只关心Web应用，那对这些问题不关注也可以，但从整个Web编程的角度来看，这些问题非常有意义。本文就主要针对一个Flask应用的运行过程进行简要分析，后续文章还会对Flask框架的一些具体问题进行分析。

为了分析方便，本文采用 **Flask 0.1版本** 的源码进行相关问题的探索。

### 一些准备知识

在正式分析Flask之前，有一些准备知识需要先了解一下：

1. 使用Flask框架开发的属于Web应用。由于Python使用`WSGI`网关，所以这个应用也可以叫`WSGI`应用；

2. 服务器、Web应用的设计应该遵循网关接口的一些规范。对于`WSGI`网关，要求Web应用实现一个函数或者一个可调用对象`webapp(environ,  start_response)`。服务器或网关中要定义`start_response`函数并且调用Web应用。关于这部分的内容可以参考：{% post_link wsgiref包——符合WSGI标准的Web服务实现（一） wsgiref包——符合WSGI标准的Web服务实现（一） %}。

3. Flask依赖于底层库`werkzeug`。相关内容可以参考：{% post_link Werkzeug库简介 Werkzeug库简介 %}。

本文暂时不对服务器或网关的具体内容进行介绍，只需对服务器、网关、Web应用之间有怎样的关系，以及它们之间如何调用有一个了解即可。

### 一个Flask应用运行的过程

#### 1. 实例化一个Flask应用

使用`app = Flask(__name__)`，可以实例化一个Flask应用。实例化的Flask应用有一些要点或特性需要注意一下：

1. 对于请求和响应的处理，Flask使用`werkzeug`库中的`Request`类和`Response`类。对于这两个类的相关内容可以参考：{% post_link Werkzeug库——wrappers模块 Werkzeug库——wrappers模块 %}。

2. 对于URL模式的处理，Flask应用使用`werkzeug`库中的`Map`类和`Rule`类，每一个URL模式对应一个`Rule`实例，这些`Rule`实例最终会作为参数传递给`Map`类构造包含所有URL模式的一个“地图”。这个地图可以用来匹配请求中的URL信息，关于`Map`类和`Rule`类的相关知识可以参考：{% post_link Werkzeug库——routing模块 Werkzeug库——routing模块 %}。

3. 当实例化一个Flask应用`app`（这个应用的名字可以随便定义）之后，对于如何添加URL模式，Flask采取了一种更加优雅的模式，对于这点可以和Django的做法进行比较。Flask采取装饰器的方法，将URL规则和视图函数结合在一起写，其中主要的函数是`route`。在上面例子中：
    ```Python
    @app.route('/')
    def index():
        pass
    ```
这样写视图函数，会将`'/'`这条URL规则和视图函数`index()`联系起来，并且会形成一个`Rule`实例，再添加进`Map`实例中去。当访问`'/'`时，会执行`index()`。关于Flask匹配URL的内容，可以参考后续文章。

4. 实例化Flask应用时，会创造一个`Jinja`环境，这是Flask自带的一种模板引擎。可以查看[Jinja文档](http://docs.jinkan.org/docs/jinja2/)，这里先暂时不做相关介绍。

5. 实例化的Flask应用是一个可调用对象。在前面讲到，Web应用要遵循`WSGI`规范，就要实现一个函数或者一个可调用对象`webapp(environ,  start_response)`，以方便服务器或网关调用。Flask应用通过`__call__(environ, start_response)`方法可以让它被服务器或网关调用。
    ```Python
    def __call__(self, environ, start_response):
        """Shortcut for :attr:`wsgi_app`"""
        return self.wsgi_app(environ, start_response)
    ```
注意到调用该方法会执行`wsgi_app(environ, start_response)`方法，之所以这样设计是为了在应用正式处理请求之前，可以加载一些“中间件”,以此改变Flask应用的相关特性。对于这一点后续会详细分析。

6. Flask应用还有一些其他的属性或方法，用于整个请求和响应过程。

#### 2.调用Flask应用时会发生什么

上面部分分析了实例化的Flask应用长什么样子。当一个完整的Flask应用实例化后，可以通过调用`app.run()`方法运行这个应用。

Flask应用的`run()`方法会调用`werkzeug.serving`模块中的`run_simple`方法。这个方法会创建一个本地的测试服务器，并且在这个服务器中运行Flask应用。关于服务器的创建这里不做说明，可以查看`werkzeug.serving`模块的有关文档。

当服务器开始调用Flask应用后，便会触发Flask应用的`__call__(environ, start_response)`方法。其中`environ`由服务器产生，`start_response`在服务器中定义。

上面我们分析到当Flask应用被调用时会执行`wsgi_app(environ, start_response)`方法。可以看出，`wsgi_app`是真正被调用的`WSGI`应用，之所以这样设计，就是为了在应用正式处理请求之前，`wsgi_app`可以被一些“中间件”装饰，以便先行处理一些操作。为了便于理解，这里先举两个例子进行说明。

##### **例子一：** 中间件SharedDataMiddleware

中间件`SharedDataMiddleware`是`werkzeug.wsgi`模块中的一个类。该类可以为Web应用提供静态内容的支持。例如：

```Python
import os
from werkzeug.wsgi import SharedDataMiddleware

app = SharedDataMiddleware(app, {
    '/shared': os.path.join(os.path.dirname(__file__), 'shared')
})
```

Flask应用通过以上的代码，`app`便会成为一个`SharedDataMiddleware`实例，之后便可以在`http://example.com/shared/`中访问`shared`文件夹下的内容。

对于中间件SharedDataMiddleware，Flask应用在初始实例化的时候便有所应用。其中有这样一段代码：

```Python
self.wsgi_app = SharedDataMiddleware(self.wsgi_app, {
                self.static_path: target
            })
```

这段代码显然会将`wsgi_app`变成一个`SharedDataMiddleware`对象，这个对象为Flask应用提供一个静态文件夹`/static`。这样，当整个Flask应用被调用时，`self.wsgi_app(environ, start_response)`会执行。由于此时`self.wsgi_app`是一个`SharedDataMiddleware`对象，所以会先触发`SharedDataMiddleware`对象的`__call__(environ, start_response)`方法。如果此时的请示是要访问`/static`这个文件夹，`SharedDataMiddleware`对象会直接返回响应；如果不是，则才会调用Flask应用的`wsgi_app(environ.start_response)`方法继续处理请求。

##### **例子二：** 中间件DispatcherMiddleware

中间件`DispatcherMiddleware`也是`werkzeug.wsgi`模块中的一个类。这个类可以讲不同的应用“合并”起来。以下是一个使用中间件`DispatcherMiddleware`的例子。

```Python
from flask import Flask
from werkzeug import DispatcherMiddleware

app1 = Flask(__name__)
app2 = Flask(__name__)
app = Flask(__name__)

@app1.route('/')
def index():
    return "This is app1!"

@app2.route('/')
def index():
    return "This is app2!"

@app.route('/')
def index():
    return "This is app!"

app = DispatcherMiddleware(app, {
            '/app1':        app1,
            '/app2':        app2
        })

if __name__ == '__main__':
    from werkzeug.serving import run_simple
    run_simple('localhost', 5000, app)
```

在上面的例子中，我们首先创建了三个不同的Flask应用，并为每个应用创建了一个视图函数。但是，我们使用了`DispatcherMiddleware`，将`app1`、`app2`和`app`合并起来。这样，此时的`app`便成为一个`DispatcherMiddleware`对象。

当在服务器中调用`app`时，由于它是一个`DispatcherMiddleware`对象，所以首先会触发它的`__call__(environ, start_response)`方法。然后根据请求URL中的信息来确定要调用哪个应用。例如：

- 如果访问`/`，则会触发`app(environ, start_response)`（**注意：** 此时app是一个Flask对象），进而处理要访问`app`的请求；

- 如果访问`/app1`，则会触发`app1(environ, start_response)`，进而处理要访问`app1`的请求。访问`/app2`同理。

#### 3. 和请求处理相关的上下文对象

当Flask应用真正处理请求时，`wsgi_app(environ, start_response)`被调用。这个函数是按照下面的方式运行的：

```Python
def wsgi_app(environ, start_response):
    with self.request_context(environ):
        ...
```

##### 请求上下文

可以看到，当Flask应用处理一个请求时，会构造一个上下文对象。所有的请求处理过程，都会在这个上下文对象中进行。这个上下文对象是`_RequestContext`类的实例。

```Python
# Flask v0.1
class _RequestContext(object):
    """The request context contains all request relevant information.  It is
    created at the beginning of the request and pushed to the
    `_request_ctx_stack` and removed at the end of it.  It will create the
    URL adapter and request object for the WSGI environment provided.
    """

    def __init__(self, app, environ):
        self.app = app
        self.url_adapter = app.url_map.bind_to_environ(environ)
        self.request = app.request_class(environ)
        self.session = app.open_session(self.request)
        self.g = _RequestGlobals()
        self.flashes = None

    def __enter__(self):
        _request_ctx_stack.push(self)

    def __exit__(self, exc_type, exc_value, tb):
        # do not pop the request stack if we are in debug mode and an
        # exception happened.  This will allow the debugger to still
        # access the request object in the interactive shell.
        if tb is None or not self.app.debug:
            _request_ctx_stack.pop()
```

根据`_RequestContext`上下文对象的定义，可以发现，在构造这个对象的时候添加了和Flask应用相关的一些属性：

- `app`  ——上下文对象的`app`属性是当前的Flask应用；

- `url_adapter`  ——上下文对象的`url_adapter`属性是通过Flask应用中的`Map`实例构造成一个`MapAdapter`实例，主要功能是将请求中的URL和`Map`实例中的URL规则进行匹配；

- `request`  ——上下文对象的`request`属性是通过`Request`类构造的实例，反映请求的信息；

- `session`  ——上下文对象的`session`属性存储请求的会话信息；

- `g`  ——上下文对象的`g`属性可以存储全局的一些变量。

- `flashes`  ——消息闪现的信息。

##### LocalStack和一些“全局变量”

**注意：**  当进入这个上下文对象时，会触发`_request_ctx_stack.push(self)`。在这里需要注意Flask中使用了`werkzeug`库中定义的一种数据结构`LocalStack`。

```Python
_request_ctx_stack = LocalStack()
```

关于`LocalStack`，可以参考：{% post_link Werkzeug库——local模块 Werkzeug库——local模块 %}。`LocalStack`是一种栈结构，每当处理一个请求时，请求上下文对象`_RequestContext`会被放入这个栈结构中。数据在栈中存储的形式表现成如下：

```Python
{880: {'stack': [<flask._RequestContext object>]}, 13232: {'stack': [<flask._RequestContext object>]}}
```

这是一个字典形式的结构，键代表当前线程/协程的标识数值，值代表当前线程/协程存储的变量。`werkzeug.local`模块构造的这种结构，很容易实现线程/协程的分离。也正是这种特性，使得可以在Flask中访问以下的“全局变量”：

```Python
current_app = LocalProxy(lambda: _request_ctx_stack.top.app)
request = LocalProxy(lambda: _request_ctx_stack.top.request)
session = LocalProxy(lambda: _request_ctx_stack.top.session)
g = LocalProxy(lambda: _request_ctx_stack.top.g)
```

其中`_request_ctx_stack.top`始终指向当前线程/协程中存储的“请求上下文”，这样像`app`、`request`、`session`、`g`等都可以以“全局”的形式存在。这里“全局”是指在当前线程或协程当中。

由此可以看出，当处理请求时：

- 首先，会生成一个请求上下文对象，这个上下文对象包含请求相关的信息。并且在进入上下文环境时，`LocalStack`会将这个上下文对象推入栈结构中以存储这个对象；

- 在这个上下文环境中可以进行请求处理过程，这个稍后再介绍。不过可以以一种“全局”的方式访问上下文对象中的变量，例如`app`、`request`、`session`、`g`等；

- 当请求结束，退出上下文环境时，`LocalStack`会清理当前线程/协程产生的数据（请求上下文对象）；

- Flask 0.1版本只有“请求上下文”的概念，在Flask 0.9版本中又增加了“应用上下文”的概念。关于“应用上下文”，以后再加以分析。

#### 4. 在上下文环境中处理请求

处理请求的过程定义在`wsgi_app`方法中，具体如下：

```Python
def wsgi_app(environ, start_response):
    with self.request_context(environ):
        rv = self.preprocess_request()
        if rv is None:
            rv = self.dispatch_request()
        response = self.make_response(rv)
        response = self.process_response(response)
        return response(environ, start_response)
```

从代码可以看出，在上下文对象中处理请求的过程分为以下几个步骤：

1. 在请求正式被处理之前的一些操作，调用`preprocess_request()`方法，例如打开一个数据库连接等操作；

2. 正式处理请求。这个过程调用`dispatch_request()`方法，这个方法会根据URL匹配的情况调用相关的视图函数；

3. 将从视图函数返回的值转变为一个`Response`对象；

4. 在响应被发送到`WSGI`服务器之前，调用`process_response(response)`做一些后续处理过程；

5. 调用`response(environ, start_response)`方法将响应发送回`WSGI`服务器。关于此方法的使用，可以参考：{% post_link Werkzeug库——wrappers模块 Werkzeug库——wrappers模块 %}；

6. 退出上下文环境时，`LocalStack`会清理当前线程/协程产生的数据（请求上下文对象）。
