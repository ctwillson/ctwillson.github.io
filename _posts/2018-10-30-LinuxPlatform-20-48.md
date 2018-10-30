---
layout: post
title: Linux Platform 之 probe 匹配
categories: "linux Driver"
description: "Linux 设备模型"
keywords:
---

## Linux Platform 之 probe 匹配

关于 platform 驱动模型网上已经很多资料了，这边主要从 driver 注册分析一下 probe 流程。
- driver 注册 platform_driver_register（xxx）
- 调用了 platform_driver_register （include/linux/platform_device.h)

```c
#define platform_driver_register(drv) \
	__platform_driver_register(drv, THIS_MODULE)
```

- __platform_driver_register 函数（drivers/base/platform.c），填充了 drv->driver 这个结构体
```
int __platform_driver_register(struct platform_driver *drv,
				struct module *owner)
{
	drv->driver.owner = owner;
	drv->driver.bus = &platform_bus_type;
	drv->driver.probe = platform_drv_probe;
	drv->driver.remove = platform_drv_remove;
	drv->driver.shutdown = platform_drv_shutdown;

	return driver_register(&drv->driver);
}
EXPORT_SYMBOL_GPL(__platform_driver_register);
```

- driver_register(drivers/base/driver.c),重点函数 bus_add_driver

```c
int driver_register(struct device_driver *drv)
{
	int ret;
	struct device_driver *other;

	BUG_ON(!drv->bus->p);
////检测总线的操作函数和驱动的操作函数是否同时存在,同时存在则提示使用总线提供的操作函数
	if ((drv->bus->probe && drv->probe) ||
	    (drv->bus->remove && drv->remove) ||
	    (drv->bus->shutdown && drv->shutdown))
		printk(KERN_WARNING "Driver '%s' needs updating - please use "
			"bus_type methods\n", drv->name);
////查找这个驱动是否已经在总线上注册，并增加引用计数，若已经注册，则返回提示信息。
	other = driver_find(drv->name, drv->bus);
	if (other) {
    //如果已经被注册，则返回提示错误。
		printk(KERN_ERR "Error: Driver '%s' is already registered, "
			"aborting...\n", drv->name);
		return -EBUSY;
	}
//若还没有注册，则在总线上注册该驱动
	ret = bus_add_driver(drv);
	if (ret)
		return ret;
	ret = driver_add_groups(drv, drv->groups);
	if (ret) {
		bus_remove_driver(drv);
		return ret;
	}
	kobject_uevent(&drv->p->kobj, KOBJ_ADD);

	return ret;
}
EXPORT_SYMBOL_GPL(driver_register);
```

- bus_add_driver(drivers/base/bus.c),重点函数 driver_attach。kset 作为设备驱动模型，在之后的文章中详细分析

```c
int bus_add_driver(struct device_driver *drv)
{
	struct bus_type *bus;
	struct driver_private *priv;
	int error = 0;
//用于增加该bus所属的顶层bus的kobject的引用计数，返回的是其所属的顶层bus的指针。
	bus = bus_get(drv->bus);
	if (!bus)
		return -EINVAL;

	pr_debug("bus: '%s': add driver %s\n", bus->name, drv->name);

	priv = kzalloc(sizeof(*priv), GFP_KERNEL);
	if (!priv) {
		error = -ENOMEM;
		goto out_put_bus;
	}
	klist_init(&priv->klist_devices, NULL, NULL);
	priv->driver = drv;
	drv->p = priv;
	priv->kobj.kset = bus->p->drivers_kset;
	error = kobject_init_and_add(&priv->kobj, &driver_ktype, NULL,
				     "%s", drv->name);
	if (error)
		goto out_unregister;
//挂载到所属总线驱动链表上
	klist_add_tail(&priv->knode_bus, &bus->p->klist_drivers);
	if (drv->bus->p->drivers_autoprobe) {
		if (driver_allows_async_probing(drv)) {
			pr_debug("bus: '%s': probing driver %s asynchronously\n",
				drv->bus->name, drv->name);
			async_schedule(driver_attach_async, drv);
		} else {
			error = driver_attach(drv);
			if (error)
				goto out_unregister;
		}
	}
	module_add_driver(drv->owner, drv);
//建立uevent属性文件
	error = driver_create_file(drv, &driver_attr_uevent);
	if (error) {
		printk(KERN_ERR "%s: uevent attr (%s) failed\n",
			__func__, drv->name);
	}
	error = driver_add_groups(drv, bus->drv_groups);
	if (error) {
		/* How the hell do we get out of this pickle? Give up */
		printk(KERN_ERR "%s: driver_create_groups(%s) failed\n",
			__func__, drv->name);
	}

	if (!drv->suppress_bind_attrs) {
		error = add_bind_files(drv);
		if (error) {
			/* Ditto */
			printk(KERN_ERR "%s: add_bind_files(%s) failed\n",
				__func__, drv->name);
		}
	}

	return 0;

out_unregister:
	kobject_put(&priv->kobj);
	/* drv->p is freed in driver_release()  */
	drv->p = NULL;
out_put_bus:
	bus_put(bus);
	return error;
}

```

- (drivers/base/dd.c)

```c
int driver_attach(struct device_driver *drv)
{
	return bus_for_each_dev(drv->bus, NULL, drv, __driver_attach);
}
EXPORT_SYMBOL_GPL(driver_attach);
```

- bus_for_each_dev（drivers/base/bus.c）,device 迭代器，遍历 bus 上挂载的 device，进行匹配，重点函数为 fn，即传进来的 `__driver_attach` 函数指针，while 循环检测返回值不为0的情况

```c
int bus_for_each_dev(struct bus_type *bus, struct device *start,
		     void *data, int (*fn)(struct device *, void *))
{
	struct klist_iter i;
	struct device *dev;
	int error = 0;

	if (!bus || !bus->p)
		return -EINVAL;

	klist_iter_init_node(&bus->p->klist_devices, &i,
			     (start ? &start->p->knode_bus : NULL));
	while ((dev = next_device(&i)) && !error)
    //fn 的参数分别为 device 和 device_driver 的指针
		error = fn(dev, data);
	klist_iter_exit(&i);
	return error;
}
EXPORT_SYMBOL_GPL(bus_for_each_dev);
```

- `__driver_attach` （drivers/base/dd.c），关注重点 driver_match_device (device 和 device_driver之间的匹配就在这里面进行)，driver_probe_device（platform_driver 中的 probe 函数什么时候调用就在这里面控制）


```c
static int __driver_attach(struct device *dev, void *data)
{
	struct device_driver *drv = data;
	int ret;

	/*
	 * Lock device and try to bind to it. We drop the error
	 * here and always return 0, because we need to keep trying
	 * to bind to devices and some drivers will return an error
	 * simply if it didn't support the device.
	 *
	 * driver_probe_device() will spit a warning if there
	 * is an error.
	 */

	ret = driver_match_device(drv, dev);
	if (ret == 0) {
		/* no match */
		return 0;
	} else if (ret == -EPROBE_DEFER) {
		dev_dbg(dev, "Device match requests probe deferral\n");
		driver_deferred_probe_add(dev);
	} else if (ret < 0) {
		dev_dbg(dev, "Bus failed to match device: %d", ret);
		return ret;
	} /* ret > 0 means positive match */

	if (dev->parent)	/* Needed for USB */
		device_lock(dev->parent);
	device_lock(dev);
	if (!dev->driver)
		driver_probe_device(drv, dev);
	device_unlock(dev);
	if (dev->parent)
		device_unlock(dev->parent);

	return 0;
}

```

- driver_match_device（drivers/base/base.h）,首先判断 drv->bus->match 是否为空，那这个函数指针是在哪里进行初始化的？其实文章一开始就说了，在调用 `__platform_driver_register` 时候，就对 drv 进行了初始化，实则调用的是 platform_bus_type 结构体里中的 match，即 `platform_match` 函数

```c
static inline int driver_match_device(struct device_driver *drv,
				      struct device *dev)
{
	return drv->bus->match ? drv->bus->match(dev, drv) : 1;
}
```

- platform_match ,匹配方式有三种，这里只分析 of_driver_match_device （设备树匹配）

```c
static int platform_match(struct device *dev, struct device_driver *drv)
{

	/* to_platform_device 调用的是我们熟悉的 container_of 用于求出首地址*/
	struct platform_device *pdev = to_platform_device(dev);
	struct platform_driver *pdrv = to_platform_driver(drv);

	/* When driver_override is set, only bind to the matching driver */
	if (pdev->driver_override)
		return !strcmp(pdev->driver_override, drv->name);

	/* Attempt an OF style match first */
	if (of_driver_match_device(dev, drv))
		return 1;

	/* Then try ACPI style match */
	if (acpi_driver_match_device(dev, drv))
		return 1;

	/* Then try to match against the id table */
	if (pdrv->id_table)
		return platform_match_id(pdrv->id_table, pdev) != NULL;

	/* fall-back to driver name match */
	return (strcmp(pdev->name, drv->name) == 0);
}
```

- of_driver_match_device（include/linux/of_device.h）,参数 drv->of_match_table 拿到 platform_driver 的 of_match_table 变量，该变量存的就是 dts 中的 compatible 信息

```c
static inline int of_driver_match_device(struct device *dev,
					 const struct device_driver *drv)
{
	return of_match_device(drv->of_match_table, dev) != NULL;
}
```

- of_match_device

```c
const struct of_device_id *of_match_device(const struct of_device_id *matches,
					   const struct device *dev)
{
	if ((!matches) || (!dev->of_node))
		return NULL;
	return of_match_node(matches, dev->of_node);
}
EXPORT_SYMBOL(of_match_device);
```

- of_match_node


```c
const struct of_device_id *of_match_node(const struct of_device_id *matches,
					 const struct device_node *node)
{
	const struct of_device_id *match;
	unsigned long flags;

	raw_spin_lock_irqsave(&devtree_lock, flags);
	match = __of_match_node(matches, node);
	raw_spin_unlock_irqrestore(&devtree_lock, flags);
	return match;
}
EXPORT_SYMBOL(of_match_node);

```

- `__of_match_node` 匹配节点，__of_match_node 通过 name、type、compatible 进行匹配


```c
static
const struct of_device_id *__of_match_node(const struct of_device_id *matches,
					   const struct device_node *node)
{
	const struct of_device_id *best_match = NULL;
	int score, best_score = 0;

	if (!matches)
		return NULL;

	for (; matches->name[0] || matches->type[0] || matches->compatible[0]; matches++) {
		score = __of_device_is_compatible(node, matches->compatible,
						  matches->type, matches->name);
		if (score > best_score) {
			best_match = matches;
			best_score = score;
		}
	}

	return best_match;
}
```

- 再来看一下 driver_probe_device

```c
int driver_probe_device(struct device_driver *drv, struct device *dev)
{
	int ret = 0;

	if (!device_is_registered(dev))
		return -ENODEV;

	pr_debug("bus: '%s': %s: matched device %s with driver %s\n",
		 drv->bus->name, __func__, dev_name(dev), drv->name);
    // powermanager runtime 机制，路径在 drivers/base/power/runtime.c ，这里不深入分析，主要是用于电源管理
	pm_runtime_get_suppliers(dev);
	if (dev->parent)
		pm_runtime_get_sync(dev->parent);

	pm_runtime_barrier(dev);
	ret = really_probe(dev, drv);
	pm_request_idle(dev);

	if (dev->parent)
		pm_runtime_put(dev->parent);

	pm_runtime_put_suppliers(dev);
	return ret;
}
```

- really_probe 函数

```c
static int really_probe(struct device *dev, struct device_driver *drv)
{
......
//在sys目录下建立连接指向自己的在sys中的drivers
	if (driver_sysfs_add(dev)) {
		printk(KERN_ERR "%s: driver_sysfs_add(%s) failed\n",
			__func__, dev_name(dev));
		goto probe_failed;
	}

	if (dev->pm_domain && dev->pm_domain->activate) {
		ret = dev->pm_domain->activate(dev);
		if (ret)
			goto probe_failed;
	}
//初始化 dev 时，bus 未指定 probe 函数，所以直接调用 ret = drv->probe(dev);
	if (dev->bus->probe) {
		ret = dev->bus->probe(dev);
		if (ret)
			goto probe_failed;
	} else if (drv->probe) {
		ret = drv->probe(dev);
		if (ret)
			goto probe_failed;
	}
......
}
```

- 上面的 probe,会直接调用 platform_drv_probe,最终通过 ret = drv->probe(dev); 调用驱动的 probe 函数，这里其实也可以看出来，probe 函数正常情况下返回值要为 0

```c
static int platform_drv_probe(struct device *_dev)
{
	struct platform_driver *drv = to_platform_driver(_dev->driver);
	struct platform_device *dev = to_platform_device(_dev);
	int ret;

	ret = of_clk_set_defaults(_dev->of_node, false);
	if (ret < 0)
		return ret;
	ret = dev_pm_domain_attach(_dev, true);
	if (ret != -EPROBE_DEFER) {
		if (drv->probe) {
			ret = drv->probe(dev);
			if (ret)
				dev_pm_domain_detach(_dev, true);
		} else {
			/* don't fail if just dev_pm_domain_attach failed */
			ret = 0;
		}
	}

	if (drv->prevent_deferred_probe && ret == -EPROBE_DEFER) {
		dev_warn(_dev, "probe deferral not supported\n");
		ret = -ENXIO;
	}

	return ret;
}
```

### 总结
跟了一堆的代码，那 platform 到底是怎么进行匹配并执行 probe 函数的呢？其实很简单，我们知道硬件刚起来的时候，bootloader 通过传参让内核选择合适的 dts，kernel 在接收到正确的 dts 时，会将各个**合适**的 node 进行注册（platform_device_register），并挂在 bus 上，底层驱动进行注册时（platform_driver_register），会先通过遍历 bus 上的 device（bus_for_each_dev），然后通过 dts 中的 compatible 进行匹配（platform_match中执行，dts 匹配只是其中一种匹配方式），当发现 driver 和 device名字相同时，好的，就可以执行我们需要的 probe 了（driver_probe_device）。