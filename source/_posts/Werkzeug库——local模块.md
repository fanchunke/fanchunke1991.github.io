---
title: Werkzeug库——local模块
date: 2017-03-22 21:33:03
tags:
    - Flask
    - Werkzeug
    - Web编程
categories:
    - Flask
---


### 一、简介

在`local`模块中，Werkzeug实现了类似Python标准库中`thread.local`的功能。`thread.local`是线程局部变量，也就是每个线程的私有变量，具有线程隔离性，可以通过线程安全的方式获取或者改变线程中的变量。参照`thread.local`，Werkzeug实现了比`thread.local`更多的功能。Werkzeug官方文档关于[local模块](http://werkzeug.pocoo.org/docs/0.10/local/)中对此进行了说明：

<!-- more -->

>The Python standard library comes with a utility called “thread locals”. A thread local is a global object in which you can put stuff in and get back later in a thread-safe way. That means whenever you set or get an object on a thread local object, the thread local object checks in which thread you are and retrieves the correct value.  

>This, however, has a few disadvantages. For example, besides threads there are other ways to handle concurrency in Python. A very popular approach is greenlets. Also, whether every request gets its own thread is not guaranteed in WSGI. It could be that a request is reusing a thread from before, and hence data is left in the thread local object.

**总结起来：**  以上文档解释了对于“并发”问题，多线程并不是唯一的方式，在Python中还有“协程”(关于协程的概念和用法可以参考：[廖雪峰的博客](http://www.liaoxuefeng.com/wiki/001374738125095c955c1e6d8bb493182103fac9270762a000/0013868328689835ecd883d910145dfa8227b539725e5ed000))。“协程”的一个显著特点在于是一个线程执行，一个线程可以存在多个协程。也可以理解为：协程会复用线程。对于`WSGI`应用来说，如果每一个线程处理一个请求，那么`thread.local`完全可以处理，但是如果每一个协程处理一个请求，那么一个线程中就存在多个请求，用`thread.local`变量处理起来会造成多个请求间数据的相互干扰。

对于上面问题，Werkzeug库解决的办法是`local`模块。`local`模块实现了四个类：

- `Local`

- `LocalStack`

- `LocalProxy`

- `LocalManager`

本文重点介绍前两个类的实现。

### 二、Local类

`Local`类能够用来存储线程的私有变量。在功能上这个`thread.local`类似。与之不同的是，`Local`类支持Python的协程。在Werkzeug库的local模块中，`Local`类实现了一种数据结构，用来保存线程的私有变量，对于其具体形式，可以参考它的构造函数：

```Python
class Local(object):
    __slots__ = ('__storage__', '__ident_func__')

    def __init__(self):
        object.__setattr__(self, '__storage__', {})
        object.__setattr__(self, '__ident_func__', get_ident)
```

从上面类定义可以看出，`Local`类具有两个属性：`__storage__`和`__ident_func__`。从构造函数来看，`__storage__`是一个字典，而`__ident_func__`是一个函数，用来识别当前线程或协程。

#### 1. `__ident_func__`

关于当前线程或协程的识别，`local`模块引入`get_ident`函数。如果支持协程，则从`greenlet`库中导入相关函数，否则从`thread`库中导入相关函数。调用`get_ident`将返回一个整数，这个整数可以确定当前线程或者协程。

```Python
try:
    from greenlet import getcurrent as get_ident
except ImportError:
    try:
        from thread import get_ident
    except ImportError:
        from _thread import get_ident
```

#### 2. `__storage__`

`__storage__`是一个字典，用来存储不同的线程/协程，以及这些线程/协程中的变量。以下是一个简单的多线程的例子，用来说明`__storage__`的具体结构。

```py
import threading
from werkzeug.local import Local

l = Local()
l.__storage__

def add_arg(arg, i):
    l.__setattr__(arg, i)

for i in range(3):
    arg = 'arg' + str(i)
    t = threading.Thread(target=add_arg, args=(arg, i))
    t.start()

l.__storage__
```

上面的例子，具体分析为：

- 首先，代码创建了一个`Local`的实例`l`，并且访问它的`__storage__`属性。由于目前还没有数据，所以`l.__storage__`的结果为`{}`;

- 代码创建了3个线程，每个线程均运行`add_arg(arg, i)`函数。这个函数会为每个线程创建一个变量，并对其赋值；

- 最后，再次访问`l.__storage__`。这次，`l`实例中将包含3个线程的信息。其结果为：

```Python
{20212: {'arg0': 0}, 20404: {'arg1': 1}, 21512: {'arg2': 2}}
```

从以上结果可以看出，`__storage__`这个字典的键表示不同的线程（通过`get_ident`函数获得线程标识数值），而值表示对应线程中的变量。这种结构将不同的线程分离开来。当某个线程要访问该线程的变量时，便可以通过`get_ident`函数获得线程标识数值，进而可以在字典中获得该键对应的值信息了。

### 三、LocalStack类

`LocalStack`类和`Local`类类似，但是它实现了栈数据结构。

在`LocalStack`类初始化的时候，便会创建一个`Local`实例，这个实例用于存储线程/协程的变量。与此同时，`LocalStack`类还实现了`push`、`pop`、`top`等方法或属性。调用这些属性或者方法时，该类会根据当前线程或协程的标识数值，在`Local`实例中对相应的数值进行操作。以下还是以一个多线程的例子进行说明：

```Python
from werkzeug.local import LocalStack, LocalProxy
import logging, random, threading, time

# 定义logging配置
logging.basicConfig(level=logging.DEBUG,
                    format='(%(threadName)-10s) %(message)s',
                    )

# 生成一个LocalStack实例_stack
_stack = LocalStack()

# 定义一个RequestConetxt类，它包含一个上下文环境。
# 当调用这个类的实例时，它会将这个上下文对象放入
# _stack栈中去。当退出该上下文环境时，栈会pop其中
# 的上下文对象。
class RequestConetxt(object):

    def __init__(self, a, b, c):
        self.a = a
        self.b = b
        self.c = c

    def __enter__(self):
        _stack.push(self)

    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_tb is None:
            _stack.pop()

    def __repr__(self):
        return '%s, %s, %s' % (self.a, self.b, self.c)


# 定义一个可供不同线程调用的方法。当不同线程调用该
# 方法时，首先会生成一个RequestConetxt实例，并在这
# 个上下文环境中先将该线程休眠一定时间，之后打印出
# 目前_stack中的信息，以及当前线程中的变量信息。
# 以上过程会循环两次。
def worker(i):
    with request_context(i):
        for j in range(2):
            pause = random.random()
            logging.debug('Sleeping %0.02f', pause)
            time.sleep(pause)
            logging.debug('stack: %s' % _stack._local.__storage__.items())
            logging.debug('ident_func(): %d' % _stack.__ident_func__())
            logging.debug('a=%s; b=%s; c=%s' %
                          (LocalProxy(lambda: _stack.top.a),
                           LocalProxy(lambda: _stack.top.b),
                           LocalProxy(lambda: _stack.top.c)))
    logging.debug('Done')

# 调用该函数生成一个RequestConetxt对象
def request_context(i):
    i = str(i+1)
    return RequestConetxt('a'+i, 'b'+i, 'c'+i)

# 在程序最开始显示_stack的最初状态
logging.debug('Stack Initial State: %s' % _stack._local.__storage__.items())

# 产生两个线程，分别调用worker函数
for i in range(2):
    t = threading.Thread(target=worker, args=(i,))
    t.start()

main_thread = threading.currentThread()
for t in threading.enumerate():
    if t is not main_thread:
        t.join()

# 在程序最后显示_stack的最终状态
logging.debug('Stack Finally State: %s' % _stack._local.__storage__.items())
```

以上例子的具体分析过程如下：

- 首先，先创建一个`LocalStack`实例`_stack`，这个实例将存储线程/协程的变量信息；

- 在程序开始运行时，先检查`_stack`中包含的信息；

- 之后创建两个线程，分别执行`worker`函数；

- `worker`函数首先会产生一个上下文对象，这个上下文对象会放入`_stack`中。在这个上下文环境中，程序执行一些操作，打印一些数据。当退出上下文环境时，`_stack`会pop该上下文对象。

- 在程序结束时，再次检查`_stack`中包含的信息。

运行上面的测试例子，产生结果如下：

```Python
(MainThread) Stack Initial State: []
(Thread-1  ) Sleeping 0.31
(Thread-2  ) Sleeping 0.02
(Thread-2  ) stack: [(880, {'stack': [a1, b1, c1]}), (13232, {'stack': [a2, b2, c2]})]
(Thread-2  ) ident_func(): 13232
(Thread-2  ) a=a2; b=b2; c=c2
(Thread-2  ) Sleeping 0.49
(Thread-1  ) stack: [(880, {'stack': [a1, b1, c1]}), (13232, {'stack': [a2, b2, c2]})]
(Thread-1  ) ident_func(): 880
(Thread-1  ) a=a1; b=b1; c=c1
(Thread-1  ) Sleeping 0.27
(Thread-2  ) stack: [(880, {'stack': [a1, b1, c1]}), (13232, {'stack': [a2, b2, c2]})]
(Thread-2  ) ident_func(): 13232
(Thread-2  ) a=a2; b=b2; c=c2
(Thread-2  ) Done
(Thread-1  ) stack: [(880, {'stack': [a1, b1, c1]})]
(Thread-1  ) ident_func(): 880
(Thread-1  ) a=a1; b=b1; c=c1
(Thread-1  ) Done
(MainThread) Stack Finally State: []
```

**注意到：**

- 当两个线程在运行时，`_stack`中会存储这两个线程的信息，每个线程的信息都保存在类似`{'stack': [a1, b1, c1]}`的结构中（注：stack键对应的是放入该栈中的对象，此处为了方便打印了该对象的一些属性）。

- 当线程在休眠和运行中切换时，通过线程的标识数值进行区分不同线程，线程1运行时它通过标识数值只会对属于该线程的数值进行操作，而不会和线程2的数值混淆，这样便起到线程隔离的效果（而不是通过锁的方式）。

- 由于是在一个上下文环境中运行，当线程执行完毕时，`_stack`会将该线程存储的信息删除掉。在上面的运行结果中可以看出，当线程2运行结束后，`_stack`中只包含线程1的相关信息。当所有线程都运行结束，`_stack`的最终状态将为空。
