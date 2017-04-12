---
title: Flask中模块化应用的实现
date: 2017-03-26 21:55:55
tags:
    - Flask
    - Web编程
categories:
    - Flask
---


Flask是一个轻量级的Web框架。虽然是轻量级的，但是对于组件一个大型的、模块化应用也是能够实现的，“蓝图”就是这样一种实现。对于模块化应用的实现，在Flask 0.2版本中进行了设计。本文暂时不对“蓝图”做详细的介绍，而是先从0.2版本中的`Module`类的实现讲起。其实，“蓝图”的实现和`Module`类的实现很相似。

<!-- more -->

### 为什么实现模块化应用

对于大型应用而言，随着功能的不断增加，整个应用的规模也会扩大。按照一定的规则将应用的不同部分进行模块化，不仅能够使整个应用逻辑清晰，也易于维护。例如，在Flask中，你也许想像如下构建一个简单的项目：

```Python
/myapplication
    /__init__.py
    /views
        /__init__.py
        /admin.py
        /frontend.py
```

以上目录结构中，我们将之前的Flask单文件修改成了一个应用包，所有的视图函数都在`views`下，并且按照功能分为了`admin`和`frontend`两个部分。为了实现这种模块化应用的构建，在0.2版本中Flask实现了`Module`类。这个类实例可以通过注册的方式，在Flask应用创建后添加进应用。

`Module`类实现了一系列的方法：

- `route(rule, **options)`

- `add_url_rule(rule, endpoint, view_func=None, **options)`

- `before_request(f)`

- `before_app_request(f)`

- `after_request(f)`

- `after_app_request(f)`

- `context_processor(f)`

- `app_context_processor(f)`

- `_record(func)`

以上方法除了`add_url_rule`和`_record`外，都可以作为装饰器在自己的模块中使用，这些装饰器都返回一个函数。通过调用`_record`方法，可以将装饰器返回的函数放到`_register_events`中。当Flask应用创建之后，通过运行`_register_events`列表中的函数，可以将这个模块注册到应用中去。

### Flask应用怎么注册一个`Module`

以下我们以一个例子来说明Flask应用怎么注册一个`Module`。

#### 1. 项目结构

这个简单的例子项目结构如下：

```Python
/myapplication
    /__init__.py
    /app.py
    /views
        /__init__.py
        /admin.py
        /blog.py
```

`admin.py`和`blog.py`两个模块的代码如下：

```Python
# admin.py
from flask import Module

admin = Module(__name__)

@admin.route('/')
def index():
    return "This is admin page!"

@admin.route('/profile')
def profile():
    return "This is profile page."
```

```Python
# blog.py
from flask import Module

blog = Module(__name__)

@blog.route('/')
def index():
    return "This is my blog!"

@blog.route('/article/<int:id>')
def article(id):
    return "The article id is %d." % id
```

以上两个模块中，我们首先分别创建了一个`Module`类，然后像写一般的视图函数一样，为每个模块增加一些规则。之后，可以在创建Flask应用的时候将这些模块引入，就可以注册了。

```Python
# app.py
from flask import Flask
from views.admin import admin
from views.blog import blog

app = Flask(__name__)

@app.route('/')
def index():
    return "This is my app."

app.register_module(blog, url_prefix='/blog')
app.register_module(admin, url_prefix='/admin')

if __name__ == '__main__':
    from werkzeug.serving import run_simple
    run_simple('localhost', 5000, app)
```

在`app.py`中：

- 我们首先引入了`admin`和`blog`两个`Module`对象；

- 之后，我们创建了一个Flask应用`app`，并且为这个应用增加了一个视图函数；

- 为了注册模块，我们调用了应用的`register_module`方法；

- 最后，从`werkzeug.serving`中我们调用`run_simple`方法，用来创建一个本地的服务器用于测试这个Flask应用。

根据以上的步骤，我们就可以测试这个应用。分别以`/blog`和`/admin`为URL前缀，就可以访问`blog`和`admin`两个模块了。

#### 2. 注册`Module`时发生了什么

根据上面的例子，只要简单的调用Flask应用的`register_module`方法，就可以注册一个`Module`了。关于`register_module`方法的代码如下：

```Python
def register_module(self, module, **options):
    """Registers a module with this application.  The keyword argument
    of this function are the same as the ones for the constructor of the
    :class:`Module` class and will override the values of the module if
    provided.
    """
    options.setdefault('url_prefix', module.url_prefix)
    state = _ModuleSetupState(self, **options)
    for func in module._register_events:
        func(state)
```

通过以上代码可以发现：

- 可以通过增加`url_prefix`来区分不同的`Module`，这在`app`注册`admin`和`blog`时我们已经看到了；

- 在注册时，我们创建了一个`_ModuleSetupState`的类，这个类接收Flask应用和一些参数生成一个`state`实例。这个实例反映了当前Flask应用的状态。

- 前面在讲到`Module`类的时候，我们讲到`Module`未注册时会将自己模块的一些功能实现都放在`_register_events`列表中，这些功能实现都是函数形式。当需要将模块注册到某一应用上时，只需要传递关于这个应用信息的参数即可，即就是上面的`state`实例。这样，通过运行函数，可以讲一些属性绑定到当前应用上去。

以上面例子中不同模块的URL绑定来讲，通过注册，应用`app`现形成了如下的URL“地图”：

```Python
>>> app.url_map
Map([<Rule '/admin/profile' (HEAD, GET) -> admin.profile>,
     <Rule '/admin/' (HEAD, GET) -> admin.index>,
     <Rule '/blog/' (HEAD, GET) -> blog.index>,
     <Rule '/' (HEAD, GET) -> index>,
     <Rule '/blog/article/<id>' (HEAD, GET) -> blog.article>,
     <Rule '/static/<filename>' (HEAD, GET) -> static>]
    )

>>> app.url_map._rules_by_endpoint
{'admin.index': [<Rule '/admin/' (HEAD, GET) -> admin.index>],
 'admin.profile': [<Rule '/admin/profile' (HEAD, GET) -> admin.profile>],
 'blog.article': [<Rule '/blog/article/<id>' (HEAD, GET) -> blog.article>],
 'blog.index': [<Rule '/blog/' (HEAD, GET) -> blog.index>],
 'index': [<Rule '/' (HEAD, GET) -> index>],
 'static': [<Rule '/static/<filename>' (HEAD, GET) -> static>]
}

>>> app.view_functions
{'admin.index': <function views.admin.index>,
 'admin.profile': <function views.admin.profile>,
 'blog.article': <function views.blog.article>,
 'blog.index': <function views.blog.index>,
 'index': <function __main__.index>
}
```

这样，就可以把不同模块的URL规则放在一起，并在`endpoint`和视图函数之间形成对应关系。关于Flask应用中URL处理，可以参考：{% post_link Flask应用中的URL处理 Flask应用中的URL处理 %}。
