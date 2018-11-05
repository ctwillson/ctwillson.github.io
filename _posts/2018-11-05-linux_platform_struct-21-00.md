---
layout: post
title: Linux Platform 之 platform 结构体
categories: "linux Driver"
description: "Linux 设备模型"
keywords:
---
## Linux Platform 之 platform_*

[上篇文章](http://hooltech.com/2018/10/30/LinuxPlatform-20-48/) 我们简要的分析了 platform 驱动开发中，最常见的 probe 函数匹配原则，而在 driver 中的 probe 函数的参数为 platform_device，这一篇文章我们来看一下 platform 设备总线模型中，最常用的结构体 `platform_bus` 、`platform_device` 以及 `platform_driver`

### platform_driver
先从我们最经常打交道的 platform_driver ，在写平台设备驱动中，我们的驱动代码都要去实例化它
```c
struct platform_driver {
	int (*probe)(struct platform_device *);
	int (*remove)(struct platform_device *);
	void (*shutdown)(struct platform_device *);
	int (*suspend)(struct platform_device *, pm_message_t state);
	int (*resume)(struct platform_device *);
	struct device_driver driver;
	const struct platform_device_id *id_table;
	bool prevent_deferred_probe;
};
```
参数作用：
- probe: 当 device 和 driver 匹配成功后，会调用 probe，整个驱动的逻辑都在这了
- remove: probe 失败后需要做的操作
- suspend: suspend，挂起，例如Android系统在按下power熄屏，需要调用的函数
- resume: resume，恢复，例如Android按下power亮屏，需要调用的函数
- driver: 这个
- id_table:probe 函数匹配规则，自从引入 dts 后，一般不使用了
- prevent_deferred_probe: 一般默认，为 true 时，是用在不支持热插拔驱动中


device_driver
```c
struct device_driver {
	const char		*name;
	struct bus_type		*bus;

	struct module		*owner;
	const char		*mod_name;	/* used for built-in modules */

	bool suppress_bind_attrs;	/* disables bind/unbind via sysfs */
	enum probe_type probe_type;

	const struct of_device_id	*of_match_table;
	const struct acpi_device_id	*acpi_match_table;

	int (*probe) (struct device *dev);
	int (*remove) (struct device *dev);
	void (*shutdown) (struct device *dev);
	int (*suspend) (struct device *dev, pm_message_t state);
	int (*resume) (struct device *dev);
	const struct attribute_group **groups;

	const struct dev_pm_ops *pm;

	struct driver_private *p;
};
```
- name，当前 driver 的名称，sysfs 中，ls /sys/bus/platform/drivers/<name>，名称就是这个 name 控制，旧版本内核中用于和 device 匹配，引入 dts 后，一般在 of_match_table 中进行匹配，当然 name 机制也在用，只不过优先级比较低而已
- bus，该driver所驱动设备的总线设备。为什么driver需要记录总线设备的指针呢？因为内核要保证在driver运行前，设备所依赖的总线能够正确初始化，当然针对平台总线，对应的 bus 就是 platform，在驱动进行注册时，会对其初始化，所以这个在驱动代码中一般不需要实现。详见（__platform_driver_register）
- owner，所有者，无需驱动填充
- mod_name，未知
- suppress_bind_attrs，例如在 sysfs 中是否暴露接口给用户空间进行 bind/unbind 驱动， ls /sys/bus/platform/drivers/xxx/，会有 bind   uevent unbind 出现，为 true 则会隐藏
- of_match_table，和 device 进行匹配
- probe\remove，这部分代码在进行驱动注册时，内核会帮忙填充，那为什么这里还需要 probe 函数呢？其实类似c++的重载，只是为了在调用 driver 的 probe，还需要进行其他的一些处理
- shutdown\suspend\resume\pm 都和电源管理有关系了，这里先不分析
- *p，私有数据

### platform_device
代码路径在 `include/linux/platform_device.h`
```c
struct platform_device {
	const char	*name;
	int		id;
	bool		id_auto;
	struct device	dev;
	u32		num_resources;
	struct resource	*resource;

	const struct platform_device_id	*id_entry;
	char *driver_override; /* Driver name to force a match */

	/* MFD cell pointer */
	struct mfd_cell *mfd_cell;

	/* arch specific additions */
	struct pdev_archdata	archdata;
};
```

这边着重关注 struct device（include/linux/device.h）
```c
struct device {
	struct device		*parent;

	struct device_private	*p;

	struct kobject kobj;
	const char		*init_name; /* initial name of the device */
	const struct device_type *type;

	struct mutex		mutex;	/* mutex to synchronize calls to
					 * its driver.
					 */

	struct bus_type	*bus;		/* type of bus device is on */
	struct device_driver *driver;	/* which driver has allocated this
					   device */
	void		*platform_data;	/* Platform specific data, device
					   core doesn't touch it */
	void		*driver_data;	/* Driver data, set and get with
					   dev_set/get_drvdata */
	struct dev_links_info	links;
	struct dev_pm_info	power;
	struct dev_pm_domain	*pm_domain;

#ifdef CONFIG_GENERIC_MSI_IRQ_DOMAIN
	struct irq_domain	*msi_domain;
#endif
#ifdef CONFIG_PINCTRL
	struct dev_pin_info	*pins;
#endif
#ifdef CONFIG_GENERIC_MSI_IRQ
	struct list_head	msi_list;
#endif

#ifdef CONFIG_NUMA
	int		numa_node;	/* NUMA node this device is close to */
#endif
	const struct dma_map_ops *dma_ops;
	u64		*dma_mask;	/* dma mask (if dma'able device) */
	u64		coherent_dma_mask;/* Like dma_mask, but for
					     alloc_coherent mappings as
					     not all hardware supports
					     64 bit addresses for consistent
					     allocations such descriptors. */
	unsigned long	dma_pfn_offset;

	struct device_dma_parameters *dma_parms;

	struct list_head	dma_pools;	/* dma pools (if dma'ble) */

	struct dma_coherent_mem	*dma_mem; /* internal for coherent mem
					     override */
#ifdef CONFIG_DMA_CMA
	struct cma *cma_area;		/* contiguous memory area for dma
					   allocations */
#endif
	struct removed_region *removed_mem;
	/* arch specific additions */
	struct dev_archdata	archdata;

	struct device_node	*of_node; /* associated device tree node */
	struct fwnode_handle	*fwnode; /* firmware device node */

	dev_t			devt;	/* dev_t, creates the sysfs "dev" */
	u32			id;	/* device instance */

	spinlock_t		devres_lock;
	struct list_head	devres_head;

	struct klist_node	knode_class;
	struct class		*class;
	const struct attribute_group **groups;	/* optional groups */

	void	(*release)(struct device *dev);
	struct iommu_group	*iommu_group;
	struct iommu_fwspec	*iommu_fwspec;

	bool			offline_disabled:1;
	bool			offline:1;
	bool			of_node_reused:1;
};
```
涉及的成员变量太多了，代码注释里面有很详细的描述，这里关注几个主要的：
- parent,这个和 platform_bus 相关， platform 驱动模型认为，device 的父设备为 platform device
- p，一个用于struct device的私有数据结构指针，该指针中会保存子设备链表、用于添加到bus/driver/prent等设备中的链表头等等
- kobj，设计 Linux 的设备驱动模型，这个之后再分析
- init_name，该设备的名称
- mutex，互斥锁
- *bus，标记在哪种总线上，针对 platform 设备驱动，则挂载的就是 platform，这样子，每个 device 就像葫芦一样挂在了藤蔓上了（bus）
- *driver,该 device 对应的 device_driver
- platform_data，一个指针，用于保存具体的平台相关的数据。具体的driver模块，可以将一些私有的数据，暂存在这里，需要使用的时候，再拿出来，因此设备模型并不关心该指针得实际含义。
- of_node,dts 相关，设备的 node 名称就保存在这里了
- groups，该设备的默认attribute集合。将会在设备注册时自动在sysfs中创建对应的文件。

### 小结

这篇文章简要分析了 struct device 已经 struct device_driver，然而在平常使用过程中，一般不会直接打交道，内核基于它们拓展了 soc device 、platform device等设备驱动，这里只是通过 platform 设备驱动模型，推出较为底层的 device 以及 device_driver而已。后续在驱动开发过程中遇到的问题再进行补充。

