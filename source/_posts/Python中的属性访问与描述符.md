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

在这里我们首先了解的是属性值会存储在对象的`__dict__`中，查找也会在对象的`__dict__`中进行查找的。至于Python对象进行属性访问时，会按照怎样的规则来查找属性值呢？这个问题在后文中进行讨论。

<!-- - 先在对象的`__dict__`中进行查找，如果找到，则返回属性的值，例如`dog.age`就可以直接在`dog`的`__dict__`中找到；
- 如果在实例对象的的`__dict__`中找不到，例如`dog.fly`，则继续在父类的`__dict__`中进行查找，因此可以在`Animal`的`__dict__`中找到`dog.fly`的值；
- 按照上面的步骤由实例到类，再到父类、基类的顺序查找对象的属性。如果可以找到，返回结果；如果找不到，则返回`AttributeError`错误。 -->

### 对象属性访问与特殊方法`__getattribute__`

正如前面所述，Python的属性访问方式很直观，使用点属性运算符。在新式类中，对对象属性的访问，都会调用特殊方法`__getattribute__`。`__getattribute__`允许我们在访问对象属性时自定义访问行为，但是使用它特别要小心无限递归的问题。

还是以上面的情景为例：

```Python
class Animal(object):
    run = True

class Dog(Animal):
    fly = False
    def __init__(self, age):
        self.age = age
    # 重写__getattribute__。需要注意的是重写的方法中不能
    # 使用对象的点运算符访问属性，否则使用点运算符访问属性时，
    # 会再次调用__getattribute__。这样就会陷入无限递归。
    # 可以使用super()方法避免这个问题。
    def __getattribute__(self, key):
        print  "calling __getattribute__\n"
        return super(Dog, self).__getattribute__(key)
    def sound(self):
        return "wang wang~"
```

上面的例子中我们重写了`__getattribute__`方法。注意我们使用了`super()`方法来避免无限循环问题。下面我们实例化一个对象来说明访问对象属性时`__getattribute__`的特性。

```Python
# 实例化对象dog
>>> dog = Dog(1)
# 访问dog对象的age属性

>>> dog.age
calling __getattribute__
1

# 访问dog对象的fly属性
>>> dog.fly
calling __getattribute__
False

# 访问dog对象的run属性
>>> dog.run
calling __getattribute__
True

# 访问dog对象的sound方法
>>> dog.sound
calling __getattribute__
<bound method Dog.sound of <__main__.Dog object at 0x0000000005A90668>>
```

由上面的验证可知，**`__getattribute__`是实例对象查找属性或方法的入口**。实例对象访问属性或方法时都需要调用到`__getattribute__`，之后才会根据一定的规则在各个`__dict__`中查找相应的属性值或方法对象，若没有找到则会调用`__getattr__`（后面会介绍到）。`__getattribute__`是Python中的一个内置方法，关于其底层实现可以查看相关官方文档，后面将要介绍的属性访问规则就是依赖于`__getattribute__`的。

### 对象属性控制

在继续介绍后面相关内容之前，让我们先来了解一下Python中和对象属性控制相关的相关方法。

- `__getattr__(self, name)`  

    `__getattr__`可以用来在当用户试图访问一个根本不存在（或者暂时不存在）的属性时，来定义类的行为。前面讲到过，当`__getattribute__`方法找不到属性时，最终会调用`__getattr__`方法。它可以用于捕捉错误的以及灵活地处理AttributeError。只有当试图访问不存在的属性时它才会被调用。

- `__setattr__(self, name, value)`

    `__setattr__`方法允许你自定义某个属性的赋值行为，不管这个属性存在与否，都可以对任意属性的任何变化都定义自己的规则。关于`__setattr__`有两点需要说明：第一，使用它时必须小心，不能写成类似`self.name = "Tom"`这样的形式，因为这样的赋值语句会调用`__setattr__`方法，这样会让其陷入无限递归；第二，你必须区分 **对象属性** 和 **类属性** 这两个概念。后面的例子中会对此进行解释。

- `__delattr__(self, name)`

    `__delattr__`用于处理删除属性时的行为。和`__setattr__`方法要注意无限递归的问题，重写该方法时不要有类似`del self.name`的写法。

还是以上面的例子进行说明，不过在这里我们要重写三个属性控制方法。

```Python
class Animal(object):
    run = True

class Dog(Animal):
    fly = False
    def __init__(self, age):
        self.age = age
    def __getattr__(self, name):
        print "calling __getattr__\n"
        if name == 'adult':
            return True if self.age >= 2 else False
        else:
            raise AttributeError
    def __setattr__(self, name, value):
        print "calling __setattr__"
        super(Dog, self).__setattr__(name, value)
    def __delattr__(self, name):
        print "calling __delattr__"
        super(Dog, self).__delattr__(name)
```

以下进行验证。首先是`__getattr__`:

```Python
# 创建实例对象dog
>>> dog = Dog(1)
calling __setattr__
# 检查一下dog和Dog的__dict__
>>> dog.__dict__
{'age': 1}
>>> Dog.__dict__
dict_proxy({'__delattr__': <function __main__.__delattr__>,
            '__doc__': None,
            '__getattr__': <function __main__.__getattr__>,
            '__init__': <function __main__.__init__>,
            '__module__': '__main__',
            '__setattr__': <function __main__.__setattr__>,
            'fly': False})

# 获取dog的age属性
>>> dog.age
1
# 获取dog的adult属性。
# 由于__getattribute__没有找到相应的属性，所以调用__getattr__。
>>> dog.adult
calling __getattr__
False

# 调用一个不存在的属性name，__getattr__捕获AttributeError错误
>>> dog.name
calling __getattr__
Traceback (most recent call last):
  File "<stdin>", line 1, in <module>
  File "<stdin>", line 10, in __getattr__
AttributeError
```

可以看到，属性访问时，当访问一个不存在的属性时触发`__getattr__`，它会对访问行为进行控制。接下来是`__setattr__`：

```Python
# 给dog.age赋值，会调用__setattr__方法
>>> dog.age = 2
calling __setattr__
>>> dog.age
2

# 先调用dog.fly时会返回False，这时因为Dog类属性中有fly属性；
# 之后再给dog.fly赋值，触发__setattr__方法。
>>> dog.fly
False
>>> dog.fly = True
calling __setattr__

# 再次查看dog.fly的值以及dog和Dog的__dict__;
# 可以看出对dog对象进行赋值，会在dog对象的__dict__中添加了一条对象属性；
# 然而，Dog类属性没有发生变化
# 注意：dog对象和Dog类中都有fly属性，访问时会选择哪个呢？
>>> dog.fly
True
>>> dog.__dict__
{'age': 2, 'fly': True}
>>> Dog.__dict__
dict_proxy({'__delattr__': <function __main__.__delattr__>,
            '__doc__': None,
            '__getattr__': <function __main__.__getattr__>,
            '__init__': <function __main__.__init__>,
            '__module__': '__main__',
            '__setattr__': <function __main__.__setattr__>,
            'fly': False})
```

实例对象的`__setattr__`方法可以定义属性的赋值行为，不管属性是否存在。当属性存在时，它会改变其值；当属性不存在时，它会添加一个对象属性信息到对象的`__dict__`中，然而这并不改变类的属性。从上面的例子可以看出来。

最后，看一下`__delattr__`：

```Python
# 由于上面的例子中我们为dog设置了fly属性，现在删除它触发__delattr__方法
>>> del dog.fly
calling __delattr__
# 再次查看dog对象的__dict__，发现和fly属性相关的信息被删除
>>> dog.__dict__
{'age': 2}
```

### 描述符

描述符是Python 2.2 版本中引进来的新概念。描述符一般用于实现对象系统的底层功能， 包括绑定和非绑定方法、类方法、静态方法特特性等。关于描述符的概念，官方并没有明确的定义，可以在网上查阅相关资料。这里我从自己的认识谈一些想法，如有不当之处还请包涵。

在前面我们了解了对象属性访问和行为控制的一些特殊方法，例如`__getattribute__`、`__getattr__`、`__setattr__`、`__delattr__`。以我的理解来看，这些方法应当具有属性的"普适性"，可以用于属性查找、设置、删除的一般方法，也就是说所有的属性都可以使用这些方法实现属性的查找、设置、删除等操作。但是，这并不能很好地实现对某个具体属性的访问控制行为。例如，上例中假如要实现`dog.age`属性的类型设置（只能是整数），如果单单去修改`__setattr__`方法满足它，那这个方法便有可能不能支持其他的属性设置。

在类中设置属性的控制行为不能很好地解决问题，Python给出的方案是：`__getattribute__`、`__getattr__`、`__setattr__`、`__delattr__`等方法用来实现属性查找、设置、删除的一般逻辑，而对属性的控制行为就由属性对象来控制。这里单独抽离出来一个属性对象，在属性对象中定义这个属性的查找、设置、删除行为。这个属性对象就是描述符。

描述符对象一般是作为其他类对象的属性而存在。在其内部定义了三个方法用来实现属性对象的查找、设置、删除行为。这三个方法分别是：

- __get__(self, instance, owner)：定义当试图取出描述符的值时的行为。
- __set__(self, instance, value)：定义当描述符的值改变时的行为。
- __delete__(self, instance)：定义当描述符的值被删除时的行为。

其中：instance为把描述符对象作为属性的对象实例；
      owner为instance的类对象。

以下以官方的一个例子进行说明：

```Python
class RevealAccess(object):

    def __init__(self, initval=None, name='var'):
        self.val = initval
        self.name = name

    def __get__(self, obj, objtype):
        print 'Retrieving', self.name
        return self.val

    def __set__(self, obj, val):
        print 'Updating', self.name
        self.val = val

class MyClass(object):
    x = RevealAccess(10, 'var "x"')
    y = 5
```

以上定义了两个类。其中`RevealAccess`类的实例是作为`MyClass`类属性`x`的值存在的。而且`RevealAccess`类定义了`__get__`、`__set__`方法，它是一个描述符对象。注意，描述符对象的`__get__`、`__set__`方法中使用了诸如`self.val`和`self.val = val`等语句，这些语句会调用`__getattribute__`、`__setattr__`等方法，这也说明了`__getattribute__`、`__setattr__`等方法在控制访问对象属性上的一般性（一般性是指对于所有属性它们的控制行为一致），以及`__get__`、`__set__`等方法在控制访问对象属性上的特殊性（特殊性是指它针对某个特定属性可以定义不同的行为）。

以下进行验证：

```Python
# 创建Myclass类的实例m
>>> m = MyClass()

# 查看m和MyClass的__dict__
>>> m.__dict__
{}
>>> MyClass.__dict__
dict_proxy({'__dict__': <attribute '__dict__' of 'MyClass' objects>,
            '__doc__': None,
            '__module__': '__main__',
            '__weakref__': <attribute '__weakref__' of 'MyClass' objects>,
            'x': <__main__.RevealAccess at 0x5130080>,
            'y': 5})

# 访问m.x。会先触发__getattribute__方法
# 由于x属性的值是一个描述符，会触发它的__get__方法
>>> m.x
Retrieving var "x"
10

# 设置m.x的值。对描述符进行赋值，会触发它的__set__方法
# 在__set__方法中还会触发__setattr__方法（self.val = val）
>>> m.x = 20
Updating var "x"

# 再次访问m.x
>>> m.x
Retrieving var "x"
20

# 查看m和MyClass的__dict__，发现这与对描述符赋值之前一样。
# 这一点与一般属性的赋值不同，可参考上述的__setattr__方法。
# 之所以前后没有发生变化，是因为变化体现在描述符对象上，
# 而不是实例对象m和类MyClass上。
>>> m.__dict__
{}
>>> MyClass.__dict__
dict_proxy({'__dict__': <attribute '__dict__' of 'MyClass' objects>,
            '__doc__': None,
            '__module__': '__main__',
            '__weakref__': <attribute '__weakref__' of 'MyClass' objects>,
            'x': <__main__.RevealAccess at 0x5130080>,
            'y': 5})
```

上面的例子对描述符进行了一定的解释，不过对描述符还需要更进一步的探讨和分析，这个工作先留待以后继续进行。

最后，还需要注意一点：描述符有数据描述符和非数据描述符之分。
- 只要至少实现`__get__`、`__set__`、`__delete__`方法中的一个就可以认为是描述符；
- 只实现`__get__`方法的对象是非数据描述符，意味着在初始化之后它们只能被读取；
- 同时实现`__get__`和`__set__`的对象是数据描述符，意味着这种属性是可读写的。

### 属性访问的优先规则

在以上的讨论中，我们一直回避着一个问题，那就是属性访问时的优先规则。我们了解到，属性一般都在`__dict__`中存储，但是在访问属性时，在对象属性、类属型、基类属性中以怎样的规则来查询属性呢？以下对Python中属性访问的规则进行分析。

由上述的分析可知，属性访问的入口点是`__getattribute__`方法。它的实现中定义了Python中属性访问的优先规则。
