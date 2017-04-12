---
title: Flask应用中的URL处理
date: 2017-03-25 21:52:35
tags:
    - Flask
    - 网络编程
categories:
    - Flask
---


在文章：{% post_link 一个Flask应用运行过程剖析 一个Flask应用运行过程剖析 %}中，在一个上下文环境中可以处理请求。如果不考虑在处理请求前后做的一些操作，Flask源码中真正处理请求的是`dispatch_request()`方法。其源码如下：

<!-- more -->

```Python
def dispatch_request(self):
    """Does the request dispatching.  Matches the URL and returns the
    return value of the view or error handler.  This does not have to
    be a response object.  In order to convert the return value to a
    proper response object, call :func:`make_response`.
    """
    try:
        endpoint, values = self.match_request()
        return self.view_functions[endpoint](**values)
    except HTTPException, e:
        handler = self.error_handlers.get(e.code)
        if handler is None:
            return e
        return handler(e)
    except Exception, e:
        handler = self.error_handlers.get(500)
        if self.debug or handler is None:
            raise
        return handler(e)
```

从上面的源码中可以看到，`dispatch_request()`方法做了如下的工作：

1. 对请求的URL进行匹配；

2. 如果URL可以匹配，则返回相对应视图函数的结果；

3. 如果不可以匹配，则进行错误处理。

对于错误的处理，本文暂不做介绍。本文主要对Flask应用的URL模式以及请求处理过程中的URL匹配进行剖析。

### Flask应用的`url_map`

Flask应用实例化的时候，会为应用增添一个`url_map`属性。这个属性是一个`Map`类，这个类在`werkzeug.routing`模块中定义，其主要的功能是为了给应用增加一些URL规则，这些URL规则形成一个`Map`实例的过程中会生成对应的正则表达式，可以进行URL匹配。相关的概念和内容可以参考：{% post_link Werkzeug库——routing模块 Werkzeug库——routing模块 %}。

在Flask源码中，它通过两个方法可以很方便地定制应用的URL。这两个方法是：`route`装饰器和`add_url_rule`方法。

#### 1. **add_url_rule**

```Python
def add_url_rule(self, rule, endpoint, **options):
    options['endpoint'] = endpoint
    options.setdefault('methods', ('GET',))
    self.url_map.add(Rule(rule, **options))
```

`add_url_rule`方法很简单，只要向其传递一条URL规则`rule`和一个`endpoint`即可。`endpoint`一般为和这条URL相关的视图函数的名字，这样处理就可以将URL和视图函数关联起来。除此之外，还可以传递一些关键字参数。调用该方法后，会调用`Map`实例的`add`方法，它会将URL规则添加进`Map`实例中。

#### 2. **route装饰器**

为了更加方便、优雅地写应用的URL，Flask实现了一个`route`装饰器。

```Python
def route(self, rule, **options):
    def decorator(f):
        self.add_url_rule(rule, f.__name__, **options)
        self.view_functions[f.__name__] = f
        return f
    return decorator
```

`route`装饰器会装饰一个视图函数。经`route`装饰的视图函数首先会调用`add_url_rule`方法，将装饰器中的URL规则添加进`Map`实例中，视图函数的名字会作为`endpoint`进行传递。然后在该应用的`view_functions`中增加`endpoint`和视图函数的对应关系。这种对应关系可以在请求成功时方便地调用对应的视图函数。

#### 3. 一个简单的例子

我们用一个简单的例子来说明以上过程的实现：

```Python
>>> from flask import Flask
>>> app = Flask(__name__)
>>> @app.route('/')
    def index():
        return "Hello, World!"
>>> @app.route('/<username>')
    def user(username):
        return "Hello, %s" % username
>>> @app.route('/page/<int:id>')
    def page(id):
        return "This is page %d" % id
```

以上代码，我们创建了一个Flask应用`app`，并且通过`route`装饰器的形式为`app`增加了3条URL规则。

**首先：** 我们看一下Flask应用的`url_map`长啥样：

```Python
>>> url_map = app.url_map
>>> url_map

Map([<Rule '/' (HEAD, GET) -> index>,
     <Rule '/static/<filename>' -> static>,
     <Rule '/page/<id>' (HEAD, GET) -> page>,
     <Rule '/<username>' (HEAD, GET) -> user>
    ])
```

可以看到，`url_map`是一个`Map`实例，这个实例中包含4个`Rule`实例，分别对应4条URL规则，其中`/static/<filename>`在Flask应用实例化时会自动添加，其余3条是用户创建的。整个`Map`类便构成了Flask应用`app`的URL“地图”，可以用作URL匹配的依据。

**接下来：** 我们看一下`url_map`中的一个属性：`_rules_by_endpoint`：

```Python
>>> rules_by_endpoint = url_map._rules_by_endpoint
>>> rules_by_endpoint

{'index': [<Rule '/' (HEAD, GET) -> index>],
 'page': [<Rule '/page/<id>' (HEAD, GET) -> page>],
 'static': [<Rule '/static/<filename>' -> static>],
 'user': [<Rule '/<username>' (HEAD, GET) -> user>]
}
```

可以看出，`_rules_by_endpoint`属性是一个字典，反映了`endpoint`和URL规则的对应关系。由于用`route`装饰器创建URL规则时，会将视图函数的名字作为`endpoint`进行传递，所以以上字典的内容也反映了视图函数和URL规则的对应关系。

**再接下来：**  我们看一下Flask应用的`view_functions`：

```Python
>>> view_functions = app.view_functions
>>> view_functions

{'index': <function __main__.index>,
 'page': <function __main__.page>,
 'user': <function __main__.user>
}
```
在用`route`装饰器创建URL规则时，它还会做一件事情：`self.view_functions[f.__name__] = f`。这样做是将函数名和视图函数的对应关系放在Flask应用的`view_functions`。由于`Map`实例中存储了函数名和URL规则的对应关系，这样只要在匹配URL规则时，如果匹配成功，只要返回一个函数名，那么便可以在`view_functions`中运行对应的视图函数。

**最后：**  我们看一下URL如何和`Map`实例中的URL规则进行匹配。我们以`/page/<int:id>`这条规则为例：

```Python
>>> rule = url_map._rules[2]
>>> rule
<Rule '/page/<id>' (HEAD, GET) -> page>

>>> rule._regex
re.compile(ur'^\|\/page\/(?P<id>\d+)$', re.UNICODE)

>>> rule._regex.pattern
u'^\\|\\/page\\/(?P<id>\\d+)$'
```

可以看到，在将一条URL规则的实例`Rule`添加进`Map`实例的时候，会为这个`Rule`生成一个正则表达式的属性`_regex`。这样当这个Flask应用处理请求时，实际上会将请求中的url和Flask应用中每一条URL规则的正则表达式进行匹配。如果匹配成功，则会返回`endpoint`和一些参数，返回的`endpoint`可以用来在`view_functions`找到对应的视图函数，返回的参数可以传递给视图函数。具体的过程就是：

```Python
try:
    # match_request()可以进行URL匹配
    endpoint, values = self.match_request()
    return self.view_functions[endpoint](**values)
    ...
```
