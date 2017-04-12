---
title: Flask中的蓝图管理
date: 2017-03-27 21:58:43
tags:
    - Flask
    - Web编程
categories:
    - Flask
---


在{% post_link Flask中模块化应用的实现 Flask中模块化应用的实现 %}一文中，我们曾分析过Flask 0.2版本中的`Module`类。这个类能够实现Flask应用的多模块化管理。在0.7版本中，Flask重新设计了模块化管理的内容，提出了“蓝图”的概念，用来取代`Module`的功能。

<!-- more -->

### 什么是“蓝图”

[官方文档](http://flask.pocoo.org/docs/0.12/blueprints/)中对“蓝图”的概念是这样描述的：

>Flask uses a concept of blueprints for making application components and supporting common patterns within an application or across applications. Blueprints can greatly simplify how large applications work and provide a central means for Flask extensions to register operations on applications. A Blueprint object works similarly to a Flask application object, but it is not actually an application. Rather it is a blueprint of how to construct or extend an application.

按照以上的描述，可以看出“蓝图”系统在Flask应用的组件化和扩展提供了很大的便利。“组件化”是指可以在Flask层上将一个Flask应用进行“分割”，实现模块化管理，这极大地简化了构建大型应用的流程，也使得应用的维护变得更加容易。另外，“蓝图”还提供了一种Flask扩展在应用上注册操作的核心方法。

“蓝图”和一个Flask应用对象很相似，但是并不是一个Flask应用对象。它是可以注册到Flask应用上的一系列操作（对于此的理解，后文会详细讲到）。使用“蓝图”，可以实现以下的一些功能：

- 将Flask应用“分割”为一系列“蓝图”的集合，简化了大型应用工作的方式；

- 在Flask应用上，以 URL 前缀和或子域名注册一个蓝图。可以以不同的URL多次注册一个蓝图；

- 通过蓝图提供模板过滤器、静态文件、模板和其它功能。

### 创建“蓝图”对象时发生了什么

“蓝图”和Flask应用的工作方式非常相似。Flask中的“蓝图”系统能够实现很多“蓝图”对象在应用层上的管理，这些“蓝图”对象可以共享应用配置。这意味着“蓝图”应该和Flask应用有一样的运行逻辑，这样一旦蓝图注册到应用上，就可以完全像Flask应用一样工作。

。在Flask应用中有一些属性，它们以字典的形式用来存放很多装饰器运行的结果。例如：`view_functions`这个字典通常存放`route`装饰器装饰的视图函数，可以用来进行URL匹配；`before_request_functions`字典会存放`before_request`装饰器装饰的视图函数，当正式处理请求前会先运行这个字典中的函数······为了实现和Flask应用相同的请求处理逻辑，“蓝图”对象也设计了同样的装饰器函数，这些函数都是一些“匿名函数”，只要传递一个参数，就可以将本蓝图上的一些操作映射到Flask应用上去。

例如：`before_request`装饰器

```Python
def before_request(self, f):
    """Like :meth:`Flask.before_request` but for a blueprint.  This function
    is only executed before each request that is handled by a function of
    that blueprint.
    """
    self.record_once(lambda s: s.app.before_request_funcs
        .setdefault(self.name, []).append(f))
    return f
```

上面的代码中，只要给这个装饰器传递参数`s`，那么这个装饰器就会将装饰的函数添加到Flask应用的`before_request_functions`字典当中，并且和该“蓝图”的名字对应起来。这样就可以实现该函数在Flask应用中可用。

由于“蓝图”的创建过程和Flask应用的创建过程是分离的，所以在“蓝图”中使用装饰器不会立即对应用产生效果。“蓝图”中装饰器函数的返回值会经过`record_once`方法存储在“蓝图”对象的`deferred_functions`列表中，这为“蓝图”对象的注册提供了一个接口：只要在注册“蓝图”时执行`deferred_functions`列表中的函数即可。

以下是一个简单的例子：

```Python
# blueprint
>>> from flask import Blueprint
>>> blog = Blueprint('blog', __name__,
                    static_folder='static',
                    template_folder='templates')

>>> @blog.route('/')
    def index():
        return "This is blog home page."

>>> @blog.before_request
    def before_request():
        return "This is before_request function."

>>> @blog.after_request
    def after_request():
        return "This is after_request function."

>>> @blog.after_app_request
    def after_app_request():
        return "This is after_app_request function."
```

上面的例子中：

- 首先我们创建了一个“蓝图”对象`blog`。创建“蓝图”对象时，必须至少传递前两个参数：`name`和`import_name`。也可以传递`static_folder`、`template_folder`、`url_prefix`等参数，`url_prefix`参数也可以在注册蓝图时传入。

- 之后，我们为`blog`增加了四条视图函数，每个函数由蓝图的装饰器装饰。此时，我们看一下“蓝图”对象的`deferred_functions`中有什么：

    ```Python
    >>> blog.deferred_functions
    [<function flask.blueprints.<lambda>>,
     <function flask.blueprints.<lambda>>,
     <function flask.blueprints.<lambda>>,
     <function flask.blueprints.<lambda>>
    ]
    ```
可以看出，此时“蓝图”对象的`deferred_functions`中已经包含了四个匿名函数，分别对应上面例子中的四个视图函数。一旦“蓝图”被注册到应用上，会执行这四个函数。

### 注册“蓝图”

Flask应用和“蓝图”中都有注册“蓝图”的接口。

**Flask应用** 中的接口是：

```Python
def register_blueprint(self, blueprint, **options):
    """Registers a blueprint on the application.

    .. versionadded:: 0.7
    """
    first_registration = False
    if blueprint.name in self.blueprints:
        assert self.blueprints[blueprint.name] is blueprint, \
            'A blueprint\'s name collision ocurred between %r and ' \
            '%r.  Both share the same name "%s".  Blueprints that ' \
            'are created on the fly need unique names.' % \
            (blueprint, self.blueprints[blueprint.name], blueprint.name)
    else:
        self.blueprints[blueprint.name] = blueprint
        first_registration = True
    blueprint.register(self, options, first_registration)
```

这个方法首先会对“蓝图”进行检查，如果已经注册，则会出现一条`assert`语句。否则，就会调用“蓝图”对象的`register`方法进行注册。

**蓝图对象** 中的接口是：

```Python
def register(self, app, options, first_registration=False):
    """Called by :meth:`Flask.register_blueprint` to register a blueprint
    on the application.  This can be overridden to customize the register
    behavior.  Keyword arguments from
    :func:`~flask.Flask.register_blueprint` are directly forwarded to this
    method in the `options` dictionary.
    """
    self._got_registered_once = True
    state = self.make_setup_state(app, options, first_registration)
    if self.has_static_folder:
        state.add_url_rule(self.static_url_path + '/<path:filename>',
                           view_func=self.send_static_file,
                           endpoint='static')

    for deferred in self.deferred_functions:
        deferred(state)
```

蓝图对象中的`register`方法首先会生成一个`BlueprintSetupState`对象，这个对象将当前应用和当前蓝图的相关信息进行关联，还将作为参数传递到蓝图对象`deferred_functions`列表中的每一个函数。这样，蓝图中的相关操作就会映射到当前应用当中。

还是以上面的例子为例：

```Python
>>> from flask import Flask
>>> app = Flask(__name__)
>>> app.url_map
Map([<Rule '/static/<filename>' (HEAD, OPTIONS, GET) -> static>])

>>> app.blueprints
{}

>>> app.before_request_funcs
{}

>>> app.after_request_funcs
{}

>>> app.register_blueprint(blog, url_prefix='/blog')
>>> app.url_map
Map([<Rule '/blog/' (HEAD, OPTIONS, GET) -> blog.index>,
     <Rule '/blog/static/<filename>' (HEAD, OPTIONS, GET) -> blog.static>,
     <Rule '/static/<filename>' (HEAD, OPTIONS, GET) -> static>
    ])

>>> app.blueprints
{'blog': <flask.blueprints.Blueprint at 0x896e7f0>}

>>> app.before_request_funcs
{'blog': [<function __main__.before_request>]}

>>> app.after_request_funcs
{None: [<function __main__.after_app_request>],
 'blog': [<function __main__.after_request>]
}
```

经过上面的例子，可以发现“蓝图”对象注册到Flask应用时，会在Flask应用对应的地方增加“蓝图”对象的相关信息。例如，`blog`对象中有一个`before_request`装饰器，注册成功后，在`app.before_request_funcs`增加了该信息，并且以蓝图名作为键进行区分。`blog`对象中还有一个`route`装饰器，它为蓝图增加了一条URL规则，最终会在Flask应用的`url_map`中出现。由于在创建蓝图时我们增加了`static_folder`参数，所以在`url_map`中我们还可以看到`'/blog/static/<filename>'`这样的URL规则。
