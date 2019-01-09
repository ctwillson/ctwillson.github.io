---
layout: post
title: Linux 进程管理（一）之基础概念
categories: "linux Driver"
description: "Linux scheduler"
keywords:
---
## Linux 进程管理（一）之基础概念

### 什么是进程

进程，就是处于执行期的程序

线程，是进程中的活动对象。内核调度的对象是线程，不是进程（如何理解？）

每个进程都由一个 task_struct 来描述，700多行的代码，32位机占用了 1.7k ，但它描述了一个进程所有的信息，如它打开的文件、进程的地址空间、挂起的信号、进程的状态等等

所有的进程都存放在一个任务队列中（task list），如图

![](http://jiantuku-img-chenan.oss-cn-beijing.aliyuncs.com/19-1-5/43992524.jpg)

通过在每个 task_struct 中的尾端添加一个 thread_info ，用于计算偏移量（如何计算？），关于计算可以关注 current 类函数，如 current_thread_info

![](http://jiantuku-img-chenan.oss-cn-beijing.aliyuncs.com/19-1-5/6430308.jpg)

进程状态以及切换

![](http://jiantuku-img-chenan.oss-cn-beijing.aliyuncs.com/19-1-7/10954841.jpg)

**创建进程**，上面说了那么多概念，这里终于可以来一个实际的例子，unix 把进程的创建分为两部分：一部分是使用 fork() 拷贝当前的进程的内容到另一个地址空间，通过这种方式创建一个子进程，子进程与父进程的区别仅仅在于PID（每个进程唯一）、PPID（父进程的进程号，子进程把它设置为被拷贝进程的PID）和统计量（如挂起的信号）；二是使用 exec()函数负责读取可执行文件并将其载入地址空间开始运行.
```c
#include <errno.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <sys/wait.h>
char command[256];
int main(void)
{
    int childpid;
    int i;
    // fork 创建进程
    if (fork() == 0){
        //child process
        char * execv_str[] = {"echo", "executed by execv",NULL};
        //exec 函数组，执行成功的话函数是不会退出的，也就是 perror 不打印
        execv("/bin/echo",execv_str);
        perror("error on exec");
        exit(0);
    }else{
        //parent process
        //wait 函数等待子进程执行完毕，这里的参数无实际意义
        wait(&childpid);
        printf("execv done\n\n");
    }
    return 0;

}
```

**写时拷贝**，从上面的叙述来看,如果 fork 一个子进程后全部拷贝父进程的内容到子进程，这显然是不合理的，这就有了 Linux 的写时拷贝，只有在写操作的时候会进行拷贝操作,我们更改一下上面的代码，两次打印 childpid 的值都为1，这时的 childid 就是写时拷贝，我们知道 linux 代码在存储时分为数据段、代码段、bss段等，写时拷贝可以保证一开始父子进程中的代码段是共享的，关于写时拷贝更多的内容可以参考[这里](https://www.cnblogs.com/biyeymyhjob/archive/2012/07/20/2601655.html)，另外关于 exec 的执行时的讨论还需要深究

```c
#include <errno.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <sys/wait.h>
char command[256];
int main(void)
{
    int childpid=0;
    int i;

    if (fork() == 0){
        //child process
        char * execv_str[] = {"echo", "executed by execv",NULL};
        printf("%d\n",++childpid);
        execv("/bin/echo",execv_str);
        perror("error on exec");
        exit(0);
    }else{
        printf("parrent %d\n",++childpid);
        //parent process
        wait(&childpid);
        printf("execv done\n\n");
    }
    return 0;

}

```

**进程终结**，通过显式调用 exit() 终结，或者隐式调用（例如接收到 kill 信息）进行进程的终结，在内核中调用 do_exit 进行清理工作，此时进程关联的资源全部被释放（假设这里的资源是当前进程独占），进程此时不可运行并处于 EXIT_ZOMBIE 状态。它所占用的所有内存只有内核栈、thread_info 以及 task_struct 结构，此时进程存在的唯一目的，就是向它的父进程提供信息。之后通过 **wait()** 函数族对子进程的 task_struct 释放工作。这里有一个问题,如果父进程异常退出了，子进程再退出，那之后的“扫尾工作”怎么办？Linux 设计的时候当然有考虑这个问题，它会先遍历子进程所在的链表以及 ptarce 所在的链表用于寻找父进程，如果找不到，就让 init 进程作为父进程。

### 进程调度
#### 策略
##### 设备类型
I/O 消耗型:如键盘，鼠标，这类设备需要很快的调度，但运行时间却很短，这类设备被称为 I/O 消耗型

cpu 消耗型:例如大型计算，处理器大部分时间用于执行代码上。这类程序，linux 应该让它减少调度，增加代码的运行时间

##### 进程优先级
进程优先级:一种是 nice 值，取值范围 -20 到 +19，ps -el 中的 N1 栏就是 nice 值的大小；第二种是实时优先级，取值范围一般从 0 到 99,数值越大进程的优先级也就越高。

`ps -eo state,uid,pid,ppid,rtprio,time,comm `中的 rtprio 一栏查看进程是否为实时进程，为 ‘-’ 则是普通进程。

那为什么要分为两种不同类型的优先级？个人理解是为了将 I/O 消耗型和 CPU 消耗型进行区分，Linux 对于这两种不同类型的设备进行不同的调度

##### 时间片
由于 I/O 消耗型和 cpu 消耗型同时存在的场景，cpu 消耗型想这个时间尽量长，用于确保调度的速度慢，而 I/O 消耗型则正好相反，所以确定这个时间片的值是非常困难的。Linux 则将处理器使用比分配给进程。这里可以举一个例子，比如视频处理程序与文本处理程序，假设它们的处理器使用比都是50%，但文本程序只要在用户输入了就可以进行睡眠，即**消耗处理器的使用比很小**，那 linux 为了保证完全公平的调度进程，则文本程序可以优先使用 cpu，即可以抢占视频处理程序

#### 调度算法
Linux 的调度器是以模块的方式提供的，目前内核支持的调度器就有，RT scheduler、Deadline scheduler、CFS scheduler及Idle scheduler,针对不同类型的进程，调度的顺序也是有讲究的，这里只给出调度的顺序，相关分析会放到代码部分进行

```
调度类	            描述	        调度策略
dl_sched_class	    deadline调度器	SCHED_DEADLINE
rt_sched_class	    实时调度器	    SCHED_FIFO、SCHED_RR
fair_sched_class	完全公平调度器	SCHED_NORMAL、SCHED_BATCH
idle_sched_class	idle task	    SCHED_IDLE
```
### 小结
至此，Linux scheduler 相关的基础概念到这里就分析完了，对于文中的内容我们已经了解了大概，下一篇我们着重开始分析 CFS，从抽象概念到具体代码
