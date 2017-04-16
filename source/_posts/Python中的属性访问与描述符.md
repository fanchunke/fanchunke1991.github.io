---
title: Python中的属性访问与描述符
date: 2017-04-16 13:07:58
tags:
    - Python
categories:
    - Python
---


在Python中，对于一个对象的属性访问，我们一般采用的是点(.)属性运算符进行操作。例如，有一个类实例对象`foo`，它有一个`name`属性，那便可以使用`foo.name`对此属性进行访问。一般而言，点(.)属性运算符比较直观，也是我们经常碰到的一种属性访问方式。然而，在点(.)属性运算符的背后却是别有洞天，值得我们对对象的属性访问进行探讨。

在进行对象属性访问的分析之前，我们需要先了解一下对象怎么表示其属性。为了便于说明，本文以新式类为例。有关新式类和旧式类的区别，大家可以查看Python官方文档。

<!-- more -->

### 对象的属性

Python中，“一切皆对象”。我们可以给对象设置各种属性。先来看一个简单的例子：

```Python
class Animal(object):
    run = True

class Dog(Animal):
    fly = False
    def __init__(self, age):
        self.age = age
    def sound(self):
        return "wang wang~"
```

上面的例子中，我们定义了两个类。类`Animal`定义了一个属性`run`；类`Dog`继承自`Animal`，定义了一个属性`fly`和两个函数。接下来，我们实例化一个对象。对象的属性可以从特殊属性`__dict__`中查看。

```Python
# 实例化一个对象dog
>>> dog = Dog(1)
# 查看dog对象的属性
>>> dog.__dict__
{'age': 1}
# 查看类Dog的属性
>>> Dog.__dict__
dict_proxy({'__doc__': None,
            '__init__': <function __main__.__init__>,
            '__module__': '__main__',
            'fly': False,
            'sound': <function __main__.sound>})
# 查看类Animal的属性
>>> Animal.__dict__
dict_proxy({'__dict__': <attribute '__dict__' of 'Animal' objects>,
            '__doc__': None,
            '__module__': '__main__',
            '__weakref__': <attribute '__weakref__' of 'Animal' objects>,
            'run': True})
```

由上面的例子可以看出：属性在哪个对象上定义，便会出现在哪个对象的`__dict__`中。例如：

- 类`Animal`定义了一个属性`run`，那这个`run`属性便只会出现在类`Animal`的`__dict__`中，而不会出现在其子类中。
- 类`Dog`定义了一个属性`fly`和两个函数，那这些属性和方法便会出现在类`Dog`的`__dict__`中，同时它们也不会出现在实例的`__dict__`中。
- 实例对象`dog`的`__dict__`中只出现了一个属性`age`，这是在初始化实例对象的时候添加的，它没有父类的属性和方法。
- 由此可知：Python中对象的属性具有 **“层次性”**，属性在哪个对象上定义，便会出现在哪个对象的`__dict__`中。

至于Python对象如何进行属性访问呢？一般有这样的规则：

- 先在对象的`__dict__`中进行查找，如果找到，则返回属性的值，例如`dog.age`就可以直接在`dog`的`__dict__`中找到；
- 如果在实例对象的的`__dict__`中找不到，例如`dog.fly`，则继续在父类的`__dict__`中进行查找，因此可以在`Animal`的`__dict__`中找到`dog.fly`的值；
- 按照上面的步骤由实例到类，再到父类、基类的顺序查找对象的属性。如果可以找到，返回结果；如果找不到，则返回`AttributeError`错误。
