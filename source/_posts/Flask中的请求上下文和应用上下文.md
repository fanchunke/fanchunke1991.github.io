---
title: Flask中的请求上下文和应用上下文
date: 2017-03-28 22:01:11
tags:
    - Flask
    - Web编程
categories:
    - Flask
---


在Flask中处理请求时，应用会生成一个“请求上下文”对象。整个请求的处理过程，都会在这个上下文对象中进行。这保证了请求的处理过程不被干扰。处理请求的具体代码如下：

```Python
def wsgi_app(self, environ, start_response):
    with self.request_context(environ):
        # with语句中生成一个`response`对象
        ...
    return response(environ, start_response)
```

<!-- more -->

在Flask 0.9版本之前，应用只有“请求上下文”对象，它包含了和请求处理相关的信息。同时Flask还根据`werkzeug.local`模块中实现的一种数据结构`LocalStack`用来存储“请求上下文”对象。这在{% post_link 一个Flask应用运行过程剖析 一个Flask应用运行过程剖析 %}中有所介绍。在0.9版本中，Flask又引入了“应用上下文”的概念。本文主要Flask中的这两个“上下文”对象。

### LocalStack

在介绍“请求上下文”和“应用上下文”之前，我们对`LocalStack`简要做一个回顾。在{% post_link Werkzeug库——local模块 Werkzeug库——local模块 %}一文中，我们讲解了`werkzeug.local`模块中实现的三个类`Local`、`LocalStack`和`LocalProxy`。关于它们的概念和详细介绍，可以查看上面的文章。这里，我们用一个例子来说明Flask中使用的一种数据结构`LocalStack`。

```Python
>>> from werkzeug.local import LocalStack
>>> import threading

# 创建一个`LocalStack`对象
>>> local_stack = LocalStack()
# 查看local_stack中存储的信息
>>> local_stack._local.__storage__
{}

# 定义一个函数，这个函数可以向`LocalStack`中添加数据
>>> def worker(i):
        local_stack.push(i)

# 使用3个线程运行函数`worker`
>>> for i in range(3):
        t = threading.Thread(target=worker, args=(i,))
        t.start()

# 再次查看local_stack中存储的信息
>>> local_stack._local.__storage__
{<greenlet.greenlet at 0x4bee5a0>: {'stack': [2]},
 <greenlet.greenlet at 0x4bee638>: {'stack': [1]},
 <greenlet.greenlet at 0x4bee6d0>: {'stack': [0]}
}
```

由上面的例子可以看出，存储在`LocalStack`中的信息以字典的形式存在：键为线程/协程的标识数值，值也是字典形式。每当有一个线程/协程上要将一个对象`push`进`LocalStack`栈中，会形成如上一个“键-值”对。这样的一种结构很好地实现了线程/协程的隔离，每个线程/协程都会根据自己线程/协程的标识数值确定存储在栈结构中的值。

`LocalStack`还实现了`push`、`pop`、`top`等方法。其中`top`方法永远指向栈顶的元素。栈顶的元素是指当前线程/协程中最后被推入栈中的元素，即`local_stack._local.stack[-1]`(注意，是`stack`键对应的对象中最后被推入的元素)。

### 请求上下文

Flask中所有的请求处理都在“请求上下文”中进行，在它设计之初便就有这个概念。由于0.9版本代码比较复杂，这里还是以0.1版本的代码为例进行说明。本质上这两个版本的“请求上下文”的运行原理没有变化，只是新版本增加了一些功能，这点在后面再进行解释。

**请求上下文——0.1版本**
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

由上面“请求上下文”的实现可知：

- “请求上下文”是一个上下文对象，实现了`__enter__`和`__exit__`方法。可以使用`with`语句构造一个上下文环境。

- 进入上下文环境时，`_request_ctx_stack`这个栈中会推入一个`_RequestContext`对象。这个栈结构就是上面讲的`LocalStack`栈。

- 推入栈中的`_RequestContext`对象有一些属性，包含了请求的的所有相关信息。例如`app`、`request`、`session`、`g`、`flashes`。还有一个`url_adapter`，这个对象可以进行URL匹配。

- 在`with`语句构造的上下文环境中可以进行请求处理。当退出上下文环境时，`_request_ctx_stack`这个栈会销毁刚才存储的上下文对象。

以上的运行逻辑使得请求的处理始终在一个上下文环境中，这保证了请求处理过程不被干扰，而且请求上下文对象保存在`LocalStack`栈中，也很好地实现了线程/协程的隔离。

以下是一个简单的例子：

```Python
# example - Flask v0.1
>>> from flask import Flask, _request_ctx_stack
>>> import threading
>>> app = Flask(__name__)
# 先观察_request_ctx_stack中包含的信息
>>> _request_ctx_stack._local.__storage__
{}

# 创建一个函数，用于向栈中推入请求上下文
# 本例中不使用`with`语句
>>> def worker():
        # 使用应用的test_request_context()方法创建请求上下文
        request_context = app.test_request_context()
        _request_ctx_stack.push(request_context)

# 创建3个进程分别执行worker方法
>>> for i in range(3):
        t = threading.Thread(target=worker)
        t.start()

# 再观察_request_ctx_stack中包含的信息
>>> _request_ctx_stack._local.__storage__
{<greenlet.greenlet at 0x5e45df0>: {'stack': [<flask._RequestContext at 0x710c668>]},
 <greenlet.greenlet at 0x5e45e88>: {'stack': [<flask._RequestContext at 0x7107f28>]},
 <greenlet.greenlet at 0x5e45f20>: {'stack': [<flask._RequestContext at 0x71077f0>]}
}
```
上面的结果显示：`_request_ctx_stack`中为每一个线程创建了一个“键-值”对，每一“键-值”对中包含一个请求上下文对象。如果使用`with`语句，在离开上下文环境时栈中销毁存储的上下文对象信息。

**请求上下文——0.9版本**

在0.9版本中，Flask引入了“应用上下文”的概念，这对“请求上下文”的实现有一定的改变。这个版本的“请求上下文”也是一个上下文对象。在使用`with`语句进入上下文环境后，`_request_ctx_stack`会存储这个上下文对象。不过与0.1版本相比，有以下几点改变：

- 请求上下文实现了`push`、`pop`方法，这使得对于请求上下文的操作更加的灵活；

- 伴随着请求上下文对象的生成并存储在栈结构中，Flask还会生成一个“应用上下文”对象，而且“应用上下文”对象也会存储在另一个栈结构中去。这是两个版本最大的不同。

我们先看一下0.9版本相关的代码：

```Python
# Flask v0.9
def push(self):
    """Binds the request context to the current context."""
    top = _request_ctx_stack.top
    if top is not None and top.preserved:
        top.pop()

    # Before we push the request context we have to ensure that there
    # is an application context.
    app_ctx = _app_ctx_stack.top
    if app_ctx is None or app_ctx.app != self.app:
        app_ctx = self.app.app_context()
        app_ctx.push()
        self._implicit_app_ctx_stack.append(app_ctx)
    else:
        self._implicit_app_ctx_stack.append(None)

    _request_ctx_stack.push(self)

    self.session = self.app.open_session(self.request)
    if self.session is None:
        self.session = self.app.make_null_session()
```

我们注意到，0.9版本的“请求上下文”的`pop`方法中，当要将一个“请求上下文”推入`_request_ctx_stack`栈中的时候，会先检查另一个栈`_app_ctx_stack`的栈顶是否存在“应用上下文”对象或者栈顶的“应用上下文”对象的应用是否是当前应用。如果不存在或者不是当前对象，Flask会自动先生成一个“应用上下文”对象，并将其推入`_app_ctx_stack`中。

我们再看离开上下文时的相关代码：

```Python
# Flask v0.9
def pop(self, exc=None):
    """Pops the request context and unbinds it by doing that.  This will
    also trigger the execution of functions registered by the
    :meth:`~flask.Flask.teardown_request` decorator.

    .. versionchanged:: 0.9
       Added the `exc` argument.
    """
    app_ctx = self._implicit_app_ctx_stack.pop()

    clear_request = False
    if not self._implicit_app_ctx_stack:
        self.preserved = False
        if exc is None:
            exc = sys.exc_info()[1]
        self.app.do_teardown_request(exc)
        clear_request = True

    rv = _request_ctx_stack.pop()
    assert rv is self, 'Popped wrong request context.  (%r instead of %r)' \
        % (rv, self)

    # get rid of circular dependencies at the end of the request
    # so that we don't require the GC to be active.
    if clear_request:
        rv.request.environ['werkzeug.request'] = None

    # Get rid of the app as well if necessary.
    if app_ctx is not None:
        app_ctx.pop(exc)
```

上面代码中的细节先不讨论。注意到当要离开以上“请求上下文”环境的时候，Flask会先将“请求上下文”对象从`_request_ctx_stack`栈中销毁，之后会根据实际的情况确定销毁“应用上下文”对象。

以下还是以一个简单的例子进行说明：

```Python
# example - Flask v0.9
>>> from flask import Flask, _request_ctx_stack, _app_ctx_stack
>>> app = Flask(__name__)

# 先检查两个栈的内容
>>> _request_ctx_stack._local.__storage__
{}
>>> _app_ctx_stack._local.__storage__
{}

# 生成一个请求上下文对象
>>> request_context = app.test_request_context()
>>> request_context.push()

# 请求上下文推入栈后，再次查看两个栈的内容
>>> _request_ctx_stack._local.__storage__
{<greenlet.greenlet at 0x6eb32a8>: {'stack': [<RequestContext 'http://localhost/' [GET] of __main__>]}}
>>> _app_ctx_stack._local.__storage__
{<greenlet.greenlet at 0x6eb32a8>: {'stack': [<flask.ctx.AppContext at 0x5c96a58>]}}

>>> request_context.pop()

# 销毁请求上下文时，再次查看两个栈的内容
>>> _request_ctx_stack._local.__storage__
{}
>>> _app_ctx_stack._local.__storage__
{}
```

### 应用上下文

上部分中简单介绍了“应用上下文”和“请求上下文”的关系。那什么是“应用上下文”呢？我们先看一下它的类：

```Python
class AppContext(object):
    """The application context binds an application object implicitly
    to the current thread or greenlet, similar to how the
    :class:`RequestContext` binds request information.  The application
    context is also implicitly created if a request context is created
    but the application is not on top of the individual application
    context.
    """

    def __init__(self, app):
        self.app = app
        self.url_adapter = app.create_url_adapter(None)

        # Like request context, app contexts can be pushed multiple times
        # but there a basic "refcount" is enough to track them.
        self._refcnt = 0

    def push(self):
        """Binds the app context to the current context."""
        self._refcnt += 1
        _app_ctx_stack.push(self)

    def pop(self, exc=None):
        """Pops the app context."""
        self._refcnt -= 1
        if self._refcnt <= 0:
            if exc is None:
                exc = sys.exc_info()[1]
            self.app.do_teardown_appcontext(exc)
        rv = _app_ctx_stack.pop()
        assert rv is self, 'Popped wrong app context.  (%r instead of %r)' \
            % (rv, self)

    def __enter__(self):
        self.push()
        return self

    def __exit__(self, exc_type, exc_value, tb):
        self.pop(exc_value)
```

由以上代码可以看出：“应用上下文”也是一个上下文对象，可以使用`with`语句构造一个上下文环境，它也实现了`push`、`pop`等方法。“应用上下文”的构造函数也和“请求上下文”类似，都有`app`、`url_adapter`等属性。“应用上下文”存在的一个主要功能就是确定请求所在的应用。

然而，以上的论述却又让人产生这样的疑问：既然“请求上下文”中也包含`app`等和当前应用相关的信息，那么只要调用`_request_ctx_stack.top.app`或者魔法`current_app`就可以确定请求所在的应用了，那为什么还需要“应用上下文”对象呢？对于单应用单请求来说，使用“请求上下文”确实就可以了。然而，Flask的设计理念之一就是多应用的支持。当在一个应用的请求上下文环境中，需要嵌套处理另一个应用的相关操作时，“请求上下文”显然就不能很好地解决问题了。如何让请求找到“正确”的应用呢？我们可能会想到，可以再增加一个请求上下文环境，并将其推入`_request_ctx_stack`栈中。由于两个上下文环境的运行是独立的，不会相互干扰，所以通过调用`_request_ctx_stack.top.app`或者魔法`current_app`也可以获得当前上下文环境正在处理哪个应用。这种办法在一定程度上可行，但是如果对于第二个应用的处理不涉及到相关请求，那也就无从谈起“请求上下文”。

为了应对这个问题，Flask中将应用相关的信息单独拿出来，形成一个“应用上下文”对象。这个对象可以和“请求上下文”一起使用，也可以单独拿出来使用。不过有一点需要注意的是：在创建“请求上下文”时一定要创建一个“应用上下文”对象。有了“应用上下文”对象，便可以很容易地确定当前处理哪个应用，这就是魔法`current_app`。在0.1版本中，`current_app`是对`_request_ctx_stack.top.app`的引用，而在0.9版本中`current_app`是对`_app_ctx_stack.top.app`的引用。

下面以一个多应用的例子进行说明：

```Python
# example - Flask v0.9
>>> from flask import Flask, _request_ctx_stack, _app_ctx_stack
# 创建两个Flask应用
>>> app = Flask(__name__)
>>> app2 = Flask(__name__)
# 先查看两个栈中的内容
>>> _request_ctx_stack._local.__storage__
{}
>>> _app_ctx_stack._local.__storage__
{}
# 构建一个app的请求上下文环境，在这个环境中运行app2的相关操作
>>> with app.test_request_context():
        print "Enter app's Request Context:"
        print _request_ctx_stack._local.__storage__
        print _app_ctx_stack._local.__storage__
        print
        with app2.app_context():
            print "Enter app2's App Context:"
            print _request_ctx_stack._local.__storage__
            print _app_ctx_stack._local.__storage__
            print
            # do something
        print "Exit app2's App Context:"
        print _request_ctx_stack._local.__storage__
        print _app_ctx_stack._local.__storage__
        print
# Result
Enter app's Request Context:
{<greenlet.greenlet object at 0x000000000727A178>: {'stack': [<RequestContext 'http://localhost/' [GET] of __main__>]}}
{<greenlet.greenlet object at 0x000000000727A178>: {'stack': [<flask.ctx.AppContext object at 0x0000000005DD0DD8>]}}

Enter app2's App Context:
{<greenlet.greenlet object at 0x000000000727A178>: {'stack': [<RequestContext 'http://localhost/' [GET] of __main__>]}}
{<greenlet.greenlet object at 0x000000000727A178>: {'stack': [<flask.ctx.AppContext object at 0x0000000005DD0DD8>, <flask.ctx.AppContext object at 0x0000000007313198>]}}

Exit app2's App Context
{<greenlet.greenlet object at 0x000000000727A178>: {'stack': [<RequestContext 'http://localhost/' [GET] of __main__>]}}
{<greenlet.greenlet object at 0x000000000727A178>: {'stack': [<flask.ctx.AppContext object at 0x0000000005DD0DD8>]}}
```

在以上的例子中：

- 我们首先创建了两个Flask应用`app`和`app2`；

- 接着我们构建了一个`app`的请求上下文环境。当进入这个环境中时，这时查看两个栈的内容，发现两个栈中已经有了当前请求的请求上下文对象和应用上下文对象。并且栈顶的元素都是`app`的请求上下文和应用上下文；

- 之后，我们再在这个环境中嵌套`app2`的应用上下文。当进入`app2`的应用上下文环境时，两个上下文环境便隔离开来，此时再查看两个栈的内容，发现`_app_ctx_stack`中推入了`app2`的应用上下文对象，并且栈顶指向它。这时在`app2`的应用上下文环境中，`current_app`便会一直指向`app2`；

- 当离开`app2`的应用上下文环境，`_app_ctx_stack`栈便会销毁`app2`的应用上下文对象。这时查看两个栈的内容，发现两个栈中只有`app`的请求的请求上下文对象和应用上下文对象。

- 最后，离开`app`的请求上下文环境后，两个栈便会销毁`app`的请求的请求上下文对象和应用上下文对象，栈为空。

### 与上下文对象有关的“全局变量”

在Flask中，为了更加方便地处理一些变量，特地提出了“全局变量”的概念。这些全局变量有：

```Python
# Flask v0.9
_request_ctx_stack = LocalStack()
_app_ctx_stack = LocalStack()
current_app = LocalProxy(_find_app)
request = LocalProxy(partial(_lookup_object, 'request'))
session = LocalProxy(partial(_lookup_object, 'session'))
g = LocalProxy(partial(_lookup_object, 'g'))

# 辅助函数
def _lookup_object(name):
    top = _request_ctx_stack.top
    if top is None:
        raise RuntimeError('working outside of request context')
    return getattr(top, name)


def _find_app():
    top = _app_ctx_stack.top
    if top is None:
        raise RuntimeError('working outside of application context')
    return top.app
```

可以看出，Flask中使用的一些“全局变量”，包括`current_app`、`request`、`session`、`g`等都来自于上下文对象。其中`current_app`一直指向`_app_ctx_stack`栈顶的“应用上下文”对象，是对当前应用的引用。而`request`、`session`、`g`等一直指向`_request_ctx_stack`栈顶的“请求上下文”对象，分别引用请求上下文的`request`、`session`和`g`。不过，从 Flask 0.10 起，对象 g 存储在应用上下文中而不再是请求上下文中。

另外一个问题，在形成这些“全局变量”的时候，使用了`werkzeug.local`模块的`LocalProxy`类。之所以要用该类，主要是为了动态地实现对栈顶元素的引用。如果不使用这个类，在生成上述“全局变量”的时候，它们因为指向栈顶元素，而栈顶元素此时为`None`，所以这些变量也会被设置为`None`常量。后续即使有上下文对象被推入栈中，相应的“全局变量”也不会发生改变。为了动态地实现对栈顶元素的引用，这里必须使用`werkzeug.local`模块的`LocalProxy`类。
