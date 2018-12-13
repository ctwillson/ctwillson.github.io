---
layout: post
title: Linux Platform 之 dts 加载流程
categories: "linux Driver"
description: "Linux 设备模型"
keywords:
---

## Linux Platform 之 dts 加载流程

### 加载流程
dts 如此繁多的节点，device 设备又是在什么时候注册的？带着这个问题开始。为了便于分析，建议各位将编译出来的 dtb 镜像通过 dtc 工具反编译成 dts 文件进行查看，命令为 dtc –I dtb –O dts –o xxx.dts xxx.dtb

先申明一点，并不是设备树文件中所有的 node 都会挂在 bus 上，比如 cpus，memory，chosen等，下面来简要说明是如何处理这几个节点的

- unflatten_device_tree，将 dts 中的节点转化为 device node 数据结构
- 解析 cpus 节点,所有 cpus 下的子节点会被注册进 soc
- 入口函数 of_platform_default_populate_init
- 上面大概说了一下 dts 前期的大致加载流程，我们不去深究它们的实现细节，这里给出和 platform device 相关的创建流程 of_platform_default_populate_init->of_platform_default_populate - > of_platform_populate()->of_platform_bus_create()->of_platform_device_create_pdata()->of_device_add()->device_add()

### 流程分析

开始代码分析前，我们先需要明白为什么要花大力气分析 dts 的加载流程，其实主要原因就是为了知道，编译出来的 dtb 镜像哪些是要转换成 platform device，哪些是一开始不加载的，哪些是要转换成其他设备（i2c,spi 等等）

通过 unflatten_device_tree 对 dts 文件的解析，最终会生成一个 device_node 的结构体，用于之后的查找。

关于平台设备创建，路径在 drivers/of/platform.c，主要做了两件事：
- 处理 reserved-memory 节点，然后为子节点中的 ramoops 创建 device 设备
- 调用 of_platform_default_populate 创建子节点


```c
static int __init of_platform_default_populate_init(void)
{
    struct device_node *node;

    if (!of_have_populated_dt())
        return -ENODEV;

    /*
     * Handle ramoops explicitly, since it is inside /reserved-memory,
     * which lacks a "compatible" property.
     */
    node = of_find_node_by_path("/reserved-memory");
    if (node) {
        node = of_find_compatible_node(node, NULL, "ramoops");
        if (node)
            of_platform_device_create(node, NULL, NULL);
    }

    /* Populate everything else. */
    of_platform_default_populate(NULL, NULL, NULL);

    return 0;
}
arch_initcall_sync(of_platform_default_populate_init);
```

of_platform_default_populate 调用了 of_platform_populate，这里需要先注意到 of_default_bus_match_table 这个结构体

```c

const struct of_device_id of_default_bus_match_table[] = {
    { .compatible = "simple-bus", },
    { .compatible = "simple-mfd", },
    { .compatible = "isa", },
#ifdef CONFIG_ARM_AMBA
    { .compatible = "arm,amba-bus", },
#endif /* CONFIG_ARM_AMBA */
    {} /* Empty terminated list */
};

int of_platform_default_populate(struct device_node *root,
                 const struct of_dev_auxdata *lookup,
                 struct device *parent)
{
    return of_platform_populate(root, of_default_bus_match_table, lookup,
                    parent);
}

```

再来看一下 of_platform_populate，主要遍历的是根节点的第一级子节点，关键函数 of_platform_bus_create

```c
int of_platform_populate(struct device_node *root,
            const struct of_device_id *matches,
            const struct of_dev_auxdata *lookup,
            struct device *parent)
{
    struct device_node *child;
    int rc = 0;
//获取根节点
    root = root ? of_node_get(root) : of_find_node_by_path("/");
    if (!root)
        return -EINVAL;

    pr_debug("%s()\n", __func__);
    pr_debug(" starting at: %pOF\n", root);
    // 遍历子节点
    for_each_child_of_node(root, child) {
        rc = of_platform_bus_create(child, matches, lookup, parent, true);
        if (rc) {
            of_node_put(child);
            break;
        }
    }
    //调用 set_bit 置位
    of_node_set_flag(root, OF_POPULATED_BUS);
//kobject 相关，用于减少引用计数
    of_node_put(root);
    return rc;
}
```

关于 dts 中的哪些节点要注册为 platform_device 的控制逻辑全部都在这里了，通过递归，一层层的创建子 node，以及子 node 的 node...,那么哪些是要注册进的呢？从代码中可以看出必须满足以下条件：
- node 中必须有 compatible 属性
- 满足上一条后，根 node 的第一级子 node 会创建
- 第二级子 node 以及以后的 node 要创建为 platform_device 时，必须挂在上一级的 node 的 compatible 必须为 "simple-bus"
- 那上一级 node 不是 "simple-bus" 的 node 怎么办呢？不好意思，platform 平台不管，对于这类 node，它们的设备创建一般都由它的上一级 node 进行，比如 i2c、spi等，会在它们相应的 bus 上创建 device

最后调用 of_platform_device_create_pdata 创建设备

```c
static int of_platform_bus_create(struct device_node *bus,
                  const struct of_device_id *matches,
                  const struct of_dev_auxdata *lookup,
                  struct device *parent, bool strict)
{
    const struct of_dev_auxdata *auxdata;
    struct device_node *child;
    struct platform_device *dev;
    const char *bus_id = NULL;
    void *platform_data = NULL;
    int rc = 0;
//确保有 compatible 属性
    /* Make sure it has a compatible property */
    if (strict && (!of_get_property(bus, "compatible", NULL))) {
        pr_debug("%s() - skipping %pOF, no compatible prop\n",
             __func__, bus);
        return 0;
    }
//检测标志位，避免重复创建
    if (of_node_check_flag(bus, OF_POPULATED_BUS)) {
        pr_debug("%s() - skipping %pOF, already populated\n",
            __func__, bus);
        return 0;
    }

    auxdata = of_dev_lookup(lookup, bus);
    if (auxdata) {
        bus_id = auxdata->name;
        platform_data = auxdata->platform_data;
    }
//兼容旧版本的dts
    if (of_device_is_compatible(bus, "arm,primecell")) {
        /*
         * Don't return an error here to keep compatibility with older
         * device tree files.
         */
        of_amba_device_create(bus, bus_id, platform_data, parent);
        return 0;
    }
//创建 platform device
    dev = of_platform_device_create_pdata(bus, bus_id, platform_data, parent);
    //
    if (!dev || !of_match_node(matches, bus))
        return 0;

    for_each_child_of_node(bus, child) {
        pr_debug("   create child: %pOF\n", child);
        rc = of_platform_bus_create(child, matches, lookup, &dev->dev, strict);
        if (rc) {
            of_node_put(child);
            break;
        }
    }
    of_node_set_flag(bus, OF_POPULATED_BUS);
    return rc;
}

```