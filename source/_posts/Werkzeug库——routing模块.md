---
title: Werkzeug库——routing模块
date: 2017-03-19 21:31:32
tags:
    - Flask
    - Werkzeug
    - Web编程
categories:
    - Flask
---


Werkzeug库的`routing`模块的主要功能在于URL解析。对于`WSGI`应用来讲，不同的URL对应不同的视图函数，`routing`模块则会对请求信息的URL进行解析并匹配，触发URL对应的视图函数，以此生成一个响应信息。`routing`模块的解析和匹配功能主要体现在三个类上：`Rule`、`Map`和`MapAdapter`。

<!-- more -->

### `Rule`类

`Rule`类继承自`RuleFactory`类。一个`Rule`的实例代表一个URL模式，一个`WSGI`应用可以处理很多不同的URL模式，这也就是说可以产生很多不同的`Rule`实例。这些`Rule`实例最终会作为参数传递给`Map`类，形成一个包含所有URL模式的对象，通过这个对象可以解析并匹配请求对应的视图函数。

关于`Rule`类有一些常用的方法：

- `empty()`  ——在实际情况中，`Rule`实例会和一个`Map`实例进行绑定。通过`empty()`方法可以将`Rule`实例和`Map`实例解除绑定。

- `get_empty_kwargs()`  ——在`empty()`方法中调用，可以获得之前`Rule`实例的参数，以便重新构造一个`Rule`实例。

- `get_rules(map)`  ——这个方法是对`RuleFactory`类中`get_rules`方法的重写，返回`Rule`实例本身。

- `refresh()`  ——当修改`Rule`实例（URL规则）后可以调用该方法，以便更新`Rule`实例和`Map`实例的绑定关系。

- `bind(map, rebind=False)`  ——将`Rule`实例和一个`Map`实例进行绑定，这个方法会调用`complie()`方法，会给`Rule`实例生成一个正则表达式。

- `complie()`  ——根据`Rule`实例的URL模式，生成一个正则表达式，以便后续对请求的`path`进行匹配。

- `match(path)`  ——将`Rule`实例和给定的`path`进行匹配。在调用`complie()`方法生成的正则表达式将会对`path`进行匹配。如果匹配，将返回这个`path`中的参数，以便后续过程使用。如果不匹配，将会由其他的`Rule`实例和这个`path`进行匹配。

**注意：**  在对给定的URL进行匹配的过程中，会使用一些`Converters`。关于`Converters`的信息后续加以介绍。

### `Map`类

通过`Map`类构造的实例可以存储所有的URL规则，这些规则是`Rule`类的实例。`Map`实例可以 通过后续的调用和给定的URL进行匹配。

关于`Map`类有一些常用的方法：

- `add(rulefactory)`  ——这个方法在构造`Map`实例的时候就会调用，它会将所有传入`Map`类中的`Rule`实例和该`Map`实例建立绑定关系。该方法还会调用`Rule`实例的`bind`方法。

- `bind`方法  ——这个方法会生成一个`MapAdapter`实例，传入`MapAdapter`的包括一些请求信息，这样可以调用`MapAdapter`实例的方法匹配给定URL。

- `bind_to_environ`方法  ——通过解析请求中的`environ`信息，然后调用上面的`bind`方法，最终会生成一个`MapAdapter`实例。

### `MapAdapter`类

`MapAdapter`类执行URL匹配的具体工作。关于`MapAdapter`类有一些常用的方法：

- `dispatch`方法  ——该方法首先会调用`MapAdapter`实例的`match()`方法，如果有匹配的`Rule`，则会执行该`Rule`对应的视图函数。

- `match`方法  ——该方法将会进行具体的URL匹配工作。它会将请求中的url和`MapAdapter`实例中的所有`Rule`进行匹配，如果有匹配成功的，则返回该`Rule`对应的`endpoint`和一些参数`rv`。`endpoint`一般会对应一个视图函数，返回的`rv`可以作为参数传入视图函数中。

### 一个简单的例子

为了说明`routing`模块的工作原理，这里使用`Werkzeug`文档中的一个例子，稍加改动后如下所示：

```Python
from werkzeug.routing import Map, Rule, NotFound, RequestRedirect, HTTPException

url_map = Map([
    Rule('/', endpoint='blog/index'),
    Rule('/<int:year>/', endpoint='blog/archive'),
    Rule('/<int:year>/<int:month>/', endpoint='blog/archive'),
    Rule('/<int:year>/<int:month>/<int:day>/', endpoint='blog/archive'),
    Rule('/<int:year>/<int:month>/<int:day>/<slug>',
         endpoint='blog/show_post'),
    Rule('/about', endpoint='blog/about_me'),
    Rule('/feeds/', endpoint='blog/feeds'),
    Rule('/feeds/<feed_name>.rss', endpoint='blog/show_feed')
])

def application(environ, start_response):
    urls = url_map.bind_to_environ(environ)
    try:
        endpoint, args = urls.match()
    except HTTPException, e:
        return e(environ, start_response)
    start_response('200 OK', [('Content-Type', 'text/plain')])
    return  ['Rule points to %r with arguments %r' % (endpoint, args)]

if __name__ == '__main__':
    from werkzeug.serving import run_simple
    run_simple('localhost', 4000, application)
```

这里我们使用`werkzeug`自带的服务器模块构造了一个Web服务器，并且设计了一个简单的`WSGI`应用——`application`。这个Web服务器可以根据URL的不同返回不同的结果。关于服务器的构造这里不再赘述，以下部分简单对`URL Routing`过程进行分析：

#### 1. 设计URL模式

设计URL模式的过程就是构造`Rule`实例的过程。上面的例子中我们构造了8个`Rule`实例，分别对应8个不同的URL模式。每个`Rule`实例还对应一个`endpoint`，这个`endpoint`可以和视图函数进行对应，以便访问某个URL时，可以触发与之对应的视图函数。下面的例子展示了`endpoint`和视图函数的对应关系。

```Python
from werkzeug.wrappers import Response
from werkzeug.routing import Map, Rule

def on_index(request):
    return Response('Hello from the index')

url_map = Map([Rule('/', endpoint='index')])
views = {'index': on_index}
```

#### 2. 构造Map实例

构造Map实例时，会调用它的`add(rulefactory)`方法。这个方法会在Map实例和各个Rule实例之间建立绑定关系，并通过调用Rule实例的`bind()`方法为每个Rule实例生成一个正则表达式。

例如，对于`'/about'`这个URL，它对应的正则表达式为：

`'^\\|\\/about$'`

对于`'/<int:year>/<int:month>/<int:day>/'`这个URL，它对应的正则表达式为：

`'^\\|\\/(?P<year>\\d+)\\/(?P<month>\\d+)\\/(?P<day>\\d+)(?<!/)(?P<__suffix__>/?)$'`

#### 3. 构造MapAdapter实例

在设计`WSGI`应用时，上述例子通过`url_map.bind_to_environ(environ)`构建了一个MapAdapter实例。这个实例将请求的相关信息和已经创建好的`Map`实例放在一起，以便进行URL匹配。

进行URL匹配的过程是通过调用MapAdapter实例的`match()`方法进行的。实质上，这个方法会将请求中的`path`传入到所有Rule实例的`match(path)`方法中，经过正则表达式的匹配来分析`path`是否和某个Rule实例匹配。如果匹配则返回对应的`endpoint`和其他的参数，这可以作为参数传入视图函数。

#### 4. 访问URL可得相关结果

之后，访问URL可以得到相对应的结果。

例如，访问`http://localhost:4000/2017/`，可以得到：

`Rule points to 'blog/archive' with arguments {'year': 2017}`

访问`http://localhost:4000/2017/3/20/`，可以得到：

`Rule points to 'blog/archive' with arguments {'month': 3, 'day': 20, 'year': 2017}`

访问`http://localhost:4000/about`，可以得到：

`Rule points to 'blog/about_me' with arguments {}`
