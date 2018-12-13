---
layout: post
title: Linux Platform 之 sysfs
categories: "linux Driver"
description: "Linux 设备模型"
keywords:
---

## Linux Platform 之 sysfs
我们知道，在每个平台设备注册后，总能在 /sys/bus/platform 中找到相应的节点，那这部分又是如何实现的？带着这个问题，我们开始 sysfs

### sysfs 简介
sysfs是一个向用户空间导出内核对象的文件系统,它不仅提供了察看内核内部数据结构的能力,还可以修改这些数据结构。特别重要的是,该文件系统高度层次化的组织:sysfs的数据项来源于内核对象( kobject ),而内核对象的层次化组织直接反映到了sysfs的目录布局中。由于系
统的所有设备和总线都是通过 kobject 组织的,所以sysfs提供了系统的硬件拓扑的一种表示。
最后,请注意 kobject 与sysfs之间的关联不是自动建立的。独立的 kobject 实例默认情况下并不
集成到sysfs。要使一个对象在sysfs文件系统中可见,需要调用 kobject_add 。但如果 kobject 是某个
内核子系统的成员,那么向sysfs的注册是自动进行的。

### sysfs 的应用
在分析 sysfs 的源码前，我们先看一下 sysfs 在内核中的应用，默认的，sysfs 挂载在 /sys 文件夹中
```shell
sdm845:/ # ls sys/
block class    dev     firmware kernel power   srs
bus   cs_press devices fs       module rstinfo
```

- /sys/devices:该目录下是全局设备结构体系，包含所有被发现的注册在各种总线上的各种物理设备。当然，这些物理设备都在 dts 中进行描述，这里有一个问题，devices 目录下的结构是如何控制的，dts 中如何进行区分？比如 systen 和 platform
```shell
sdm845:/sys/devices # ls
platform mas-qhm-memnoc-cfg   slv-qhs-ddrss-cfg         system
```

- /sys/dev:该目录下存放主次设备号文件，其中分成字符设备、块设备的主次设备号码(major:minor)组成的文件名，该文件是链接文件并且链接到其真实的设备(/sys/devices)。
```shell
sdm845:/sys/dev # ls
block char
```

- /sys/bus:该目录下的每个子目录都是kernel支持并且已经注册了的总线类型。子目录中，例如 platform，device 目录其实也是一些符号链接，指向的是 /sys/devices 下的具体 device，而 driver 目录则是具体注册的驱动。
```shell
sdm845:/sys/bus # ls
amba        edac         iio      msm-bus-type sdio      spi
clockevents event_source mdio_bus msm_subsys   serio     spmi
clocksource gpio         media    pci          slimbus   usb
container   hid          mipi-dsi platform     soc       workqueue
cpu         i2c          mmc      scsi         soundwire
```

-  /sys/fs:该目录使用来描述系统中所有的文件系统，包括文件系统本身和按照文件系统分类存放的已挂载点
```shell
sdm845:/sys # ls fs/
bpf cgroup ecryptfs ext4 f2fs fuse pstore selinux
```

- /sys/module:该目录下有系统中所有的模块信息，不论这些模块是以内联(inlined)方式编译到内核映像文件中还是编译为外模块(.ko文件)，都可能出现在/sys/module中。即module目录下包含了所有的被载入kernel的模块。
```shell
sdm845:/sys # ls module/
cam_context_utils     lpm_levels              snd_soc_wcd934x
cam_cpas_hw           lpm_stats               snd_soc_wcd9xxx
cam_csiphy_core       mmcblk                  snd_soc_wcd_mbhc
cam_debug_util        mousedev                snd_soc_wcd_spi
cdc_ncm               msm_drm                 snd_timer
```

- /sys/firmware: dts 相关的东西，可以看到 dts 中的节点

### /sys 中添加文件

先来看一下如何向 /sys 中添加文件

```c
static DEVICE_ATTR(xxx, S_IRUGO | S_IWUSR, dsi_display_xxx_show, dsi_display_xxx_store);

static struct attribute *dsi_display_attrs[] = {
	&dev_attr_xxx.attr,
	NULL,
};

static struct attribute_group dsi_display_attr_group = {
	.name = "display",
	.attrs = dsi_display_attrs,
};
......
/* 针对多个节点的注册方式*/
rc = sysfs_create_group(&pdev->dev.kobj, &dsi_display_attr_group);
......
/* 单个节点的注册方式 */
int device_create_file(struct device *dev, const struct device_attribute * attr);
void device_remove_file(struct device *dev, const struct device_attribute * attr);
/*详见Documentation/filesystems/sysfs.txt */
```

- DEVICE_ATTR（include/linux/device.h）,实际定义了一个 struct driver_attribute dev_attr_xxx {}的结构体,driver_attribute 中有一个结构体成员变量 attribute，所谓的attibute，就是内核空间和用户空间进行信息交互的一种方法。例如某个driver定义了一个变量，却希望用户空间程序可以修改该变量，以控制driver的运行行为，那么就可以将该变量以sysfs attribute 的形式开放出来
    - 驱动工程师因为需要编写各种节点，所以需要了解如何编写 show/store 函数，来看一下 driver_attribute 
    ```c
    struct driver_attribute {
    	struct attribute attr;
    	ssize_t (*show)(struct device_driver *driver, char *buf);
    	ssize_t (*store)(struct device_driver *driver, const char *buf,
    			 size_t count);
    };
    ```
    - 针对 show 函数，调用 scnprintf 存入 buf 即可。
    ```c
    return scnprintf(buf, PAGE_SIZE,"xxx",xxx);
    ```
    - 针对 store 函数，驱动工程师只需要做调用 kstrtouint 将 buf 转换成整形，然后将 level 做相应的处理操作即可,最后 return count
    ```c
    kstrtouint(buf, 0, &level)
    ......
    return count
    ```

- 开始之前先了解一个 device 设备在注册时的流程：device_init -> device_initialize -> kobject_init(&dev->kobj, &device_ktype); device_ktype 的定义如下，这样子就初始化完成了一个 kobject 对象，这个有什么后面就可以看到了。
```c
static struct kobj_type device_ktype = {
	.release	= device_release,
	.sysfs_ops	= &dev_sysfs_ops,
	.namespace	= device_namespace,
};
```

- sysfs_create_group: 针对 platform，调用后会在 /sys/devices/platform/<dts 中的树形结构>/xxx ,传入的参数只有 attr ，那是如何定位到 dsi_display_xxx_show，dsi_display_xxx_store 的？这里简要分析一下相关的流程：
	- sysfs_create_group 调用了 internal_create_group,如果定义了 name 变量，则创建的节点前会调用 kernfs_create_dir 创建 name 的父目录
	```c
    static int internal_create_group(struct kobject *kobj, int update,
				 const struct attribute_group *grp)
    .......
    if (grp->name) {
		kn = kernfs_create_dir(kobj->sd, grp->name,
				       S_IRWXU | S_IRUGO | S_IXUGO, kobj);
		if (IS_ERR(kn)) {
			if (PTR_ERR(kn) == -EEXIST)
				sysfs_warn_dup(kobj->sd, grp->name);
			return PTR_ERR(kn);
		}
	} else
		kn = kobj->sd;
	kernfs_get(kn);
	error = create_files(kn, kobj, grp, update);
    ......
    ```
    - create_files 中会遍历 attribute_group 中的每一个 attribute ，然后调用 sysfs_add_file_mode_ns
    - 最终调用 __kernfs_create_file