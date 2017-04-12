---
title: Werkzeug库简介
date: 2017-03-17 21:25:40
tags:
    - Flask
    - Werkzeug
    - Web编程
categories:
    - Flask
---


### 简介

`Werkzeug`是一个Python写成的`WSGI`工具集。它遵循`WSGI`规范，对服务器和Web应用之间的“中间层”进行了开发，衍生出一系列非常有用的Web服务底层模块。关于`Werkzeug`功能的最简单的一个例子如下：

<!-- more -->

```Python
from werkzeug.wrappers import Request, Response

def application(environ, start_response):
    request = Request(environ)
    response = Response("Hello %s!" % request.args.get('name', 'World!'))
    return response(environ, start_response)

if __name__ == '__main__':
    from werkzeug.serving import run_simple
    run_simple('localhost', 4000, application)

```

运行上面的例子，当在浏览器输入`http://localhost:4000/`就会向本地的服务器发出一个请求。在请求的过程中，`werkzeug`主要做了下面几件事情：

1. 根据服务器和WSGI服务器产生的`environ`环境信息，封装一个`Request`实例，这个实例包含请求的所有信息；

2. Web应用根据封装的`Request`实例信息，产生一个`Response`实例（上述例子只是输出一段字符串）。这个`Response`实例是一个可调用的`WSGI`应用；

3. 上一步骤产生的可调用应用对象`response`调用`response(environ, start_response)`生成响应信息并发回客户端。调用函数是由`WSGI`规范规定的。

以上过程很好地将服务器和web应用分离开来：服务器不用考虑请求信息怎么被解析给web应用，以及后续怎么和web应用通信；web应用也不用考虑怎么将响应信息返回给服务器。服务器要做的只是提供web应用所需的请求信息，web应用提供的也只是响应信息，中间的处理过程`werkzeug`可以帮助完成。

### 模块

`werkzeug`库主要的模块有：

- {% post_link Werkzeug库——wrappers模块 Werkzeug库——wrappers模块 %}
- {% post_link Werkzeug库——routing模块 Werkzeug库——routing模块 %}
- {% post_link Werkzeug库——local模块 Werkzeug库——local模块 %}
- 后续继续更新······

详情可以查看介绍各模块的具体文章。
