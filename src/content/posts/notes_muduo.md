---
title: Notes on Muduo - Fundamental Knowledge
published: 2026-04-26
description: 'The domain knowledge required in C++ language and networking to start studying muduo, a famous network library.'
image: ''
tags: [muduo, networking]
category: 'tech'
draft: false 
lang: 'en'
---
*Muduo* is an open-source network library. 

# C++ fundamentals
## callback
:::note
a callback is a function (or callable object) that you pass to another function so it can be called later when a certain event happens or when some work is finished.
:::
In traditional C++, callback is usually implemented by **function pointer**, which is the C-style way, while in modern C++ (C++11 and after), it is **keyword `function`** that is more frequently used. A simple example is as follows:
```cpp
#include <iostream>
using namespace std;

void execute(function<void()> func) {
    func();
}

int main() {
    execute([]() {
        cout << "Hello from lambda callback!\n";
    });
}
```
## lambda expression
A lambda expression is essentially an anonymous function.
The standard syntax of a C++ lambda looks a bit like a spaceship: []() -> {}. Here is how it breaks down:
```cpp
[captures] (parameters) -> return_type {
    // function body
};
```
- [captures] (The Capture Clause): This is the lambda's superpower. It allows the lambda to "see" and use variables from the surrounding code where the lambda was created. You can't do this with a standard C-style function pointer!

- (parameters): Just like a normal function, this is where you define what inputs the lambda accepts (e.g., int x, int y).

- -> return_type (Optional): The type of value the lambda returns. You usually don't need to write this because C++ is smart enough to figure it out automatically based on your return statement.

- { body }: The actual code that runs when the lambda is called.

## quick review

Let's just finish the lesson by giving an example:
```cpp
#include <iostream>
#include <functional>

// 1. The function accepting a callback
// It takes two numbers, and a callback function named 'operation'
void doMath(int a, int b, const std::function<void(int, int)>& operation) {
    // It just "calls back" the function you gave it, passing the two numbers.
    operation(a, b); 
}

int main() {
    int num1 = 10;
    int num2 = 5;

    // 2. Calling the function and passing a lambda to ADD
    std::cout << "Passing an addition lambda:\n";
    doMath(num1, num2, [](int x, int y) {
        std::cout << "Result: " << x + y << "\n";
    });

    // 3. Calling the exact same function, but passing a lambda to MULTIPLY
    std::cout << "\nPassing a multiplication lambda:\n";
    doMath(num1, num2, [](int x, int y) {
        std::cout << "Result: " << x * y << "\n";
    });

    return 0;
}
```

## smart pointer
A smart pointer is a tool that automatically cleans up memory for you.
### unique_ptr
What it means: "I am the only one who owns this memory."
```cpp
#include <iostream>
#include <memory>
#include <string>

class Robot {
public:
    std::string name;
    Robot(std::string n) : name(n) {
        std::cout << "Robot " << name << " is powered ON.\n";
    }
    ~Robot() {
        std::cout << "Robot " << name << " is powered OFF (Memory freed).\n";
    }
};

int main() {
    // 1. You build and own the robot
    std::unique_ptr<Robot> myRobot = std::make_unique<Robot>("Wall-E");
    std::cout << "I own: " << myRobot->name << "\n";

    // 2. ERROR: You cannot copy a unique_ptr! 
    // std::unique_ptr<Robot> friendRobot = myRobot; // This will not compile.

    // 3. TRANSFERRING OWNERSHIP using std::move
    std::cout << "Transferring ownership to my friend...\n";
    std::unique_ptr<Robot> friendRobot = std::move(myRobot);

    // 4. Checking who owns it now
    std::cout << "Friend owns: " << friendRobot->name << "\n";
    
    if (myRobot == nullptr) {
        std::cout << "I have no robot anymore!\n";
    }

    // When the program ends, friendRobot goes out of scope and the Robot is destroyed.
    return 0; 
}
```
### shared_ptr
What it means: "Me and a few of my friends are sharing this memory."
```cpp
#include <iostream>
#include <memory>
#include <string>

class Song {
public:
    std::string title;
    Song(std::string t) : title(t) {
        std::cout << "Loading audio file: " << title << "\n";
    }
    ~Song() {
        std::cout << "Deleting audio file: " << title << " (No one is listening anymore)\n";
    }
};

int main() {
    // 1. Load the song into memory. The "use_count" is 1.
    std::shared_ptr<Song> masterTrack = std::make_shared<Song>("Bohemian Rhapsody");
    std::cout << "Count after loading: " << masterTrack.use_count() << "\n\n";

    {
        // 2. Add it to a playlist (Creates a new scope)
        std::shared_ptr<Song> playlistA = masterTrack;
        std::cout << "Added to Playlist A. Count is now: " << masterTrack.use_count() << "\n";

        // 3. Add it to another playlist
        std::shared_ptr<Song> playlistB = masterTrack;
        std::cout << "Added to Playlist B. Count is now: " << masterTrack.use_count() << "\n\n";

    } // Scope ends! playlistA and playlistB are destroyed here.

    // 4. Checking the count after the playlists are gone
    std::cout << "Playlists deleted. Count is back to: " << masterTrack.use_count() << "\n";
    std::cout << "Master track is still alive because we still own it.\n\n";

    // When main() finishes, masterTrack is destroyed, the count hits 0, and the Song is deleted.
    return 0;
}
```
## `std::bind`
In C++, `std::bind` is a tool that lets you take an existing function and create a new function from it by "pre-filling" some of its arguments.
### why do we use it?
Usually, we use it to make a function "fit" into a callback that expects fewer arguments. If a callback system only gives you one argument, but your function needs two, you can use `std::bind` to lock in the second argument ahead of time.
### a simple example
This example demonstrates how to prefil one parameter of a function by using `std::bind`.
```cpp
#include <iostream>
#include <functional> // Required for std::bind and std::placeholders

// A standard function that takes TWO arguments
int multiply(int a, int b) {
    return a * b;
}

int main() {
    // We are binding the 'multiply' function.
    // We lock the first argument (a) to the number 10.
    // We leave the second argument (b) blank using the placeholder _1.
    auto multiplyByTen = std::bind(multiply, 10, std::placeholders::_1);

    // Now, multiplyByTen acts like a function that only takes ONE argument!
    std::cout << "10 * 5 = " << multiplyByTen(5) << "\n";  // Outputs: 50
    std::cout << "10 * 12 = " << multiplyByTen(12) << "\n"; // Outputs: 120

    return 0;
}
```
:::tip
Here is a very important secret about modern C++: You probably shouldn't use std::bind anymore. It was very popular in C++11, but as lambdas evolved in C++14 and beyond, the C++ community mostly stopped using std::bind. **Lambdas do the exact same job, but they are much easier to read**, they compile faster, and they are easier for the compiler to optimize.
:::

# TCP Basics
:::note
TCP (Transmission Control Protocol) is a connection-oriented, reliable protocol. This means a dedicated connection must be established between a client and a server before any data can be exchanged.
:::
To understand how this works in code, we use Sockets. In C++, network programming is typically done using the POSIX socket API (on Linux/macOS) or Winsock (on Windows). The examples below use the POSIX standard, which is the foundational API for C/C++ networking.

## Server-Side Flow

- `socket()`: Creates a socket (an endpoint for communication). Think of it as purchasing a phone.

- `bind()`: Associates the socket with a specific IP address and Port number. Think of this as assigning a phone number to your phone.

- `listen()`: Puts the socket into a passive mode, waiting for incoming client connections.

- `accept()`: Blocks (waits) until a client connects. Once connected, it returns a new socket descriptor dedicated entirely to that specific client.

- `recv()`/ `send()` (or `read()` / `write()`): Receives data from the client and sends data back.

- `close()`: Terminates the connection and releases the socket resources.

## Client-Side Flow

- `socket()`: Creates a socket.

- `connect()`: Initiates a connection to the server's IP address and Port. This triggers the TCP "Three-Way Handshake."

- `send()` / `recv()`: Sends data to the server and receives the server's response.

- `close()`: Terminates the connection.

## Implementation Codes

Below is a minimal, functional example of a TCP Echo Server and a Client in C++.

### Server

```cpp title="server.cpp" {10-11}
#include <iostream>
#include <cstring>
#include <unistd.h>      // close()
#include <arpa/inet.h>   // socket(), bind(), listen(), accept()

int main() {
    // 1. Create the socket
    // AF_INET = IPv4, SOCK_STREAM = TCP
    int server_fd = socket(AF_INET, SOCK_STREAM, 0);
    
    if (server_fd == -1) {
        std::cerr << "Failed to create socket." << std::endl;
        return 1;
    }

    // 2. Bind the socket to an IP and Port
    struct sockaddr_in server_addr;
    server_addr.sin_family = AF_INET;
    server_addr.sin_addr.s_addr = INADDR_ANY; // Listen on all available network interfaces
    server_addr.sin_port = htons(8080);       // Port 8080 (htons converts to network byte order)

    if (bind(server_fd, (struct sockaddr*)&server_addr, sizeof(server_addr)) < 0) {
        std::cerr << "Bind failed." << std::endl;
        return 1;
    }

    // 3. Listen for incoming connections (max 3 pending connections in queue)
    if (listen(server_fd, 3) < 0) {
        std::cerr << "Listen failed." << std::endl;
        return 1;
    }
    std::cout << "Server is listening on port 8080..." << std::endl;

    // 4. Accept a client connection
    struct sockaddr_in client_addr;
    socklen_t client_len = sizeof(client_addr);
    int client_socket = accept(server_fd, (struct sockaddr*)&client_addr, &client_len); // the program will block here if the queue is empty.
    if (client_socket < 0) {
        std::cerr << "Accept failed." << std::endl;
        return 1;
    }
    std::cout << "Client connected!" << std::endl;

    // 5. Receive and Send data
    char buffer[1024] = {0};
    int bytes_read = read(client_socket, buffer, sizeof(buffer));
    std::cout << "Received from client: " << buffer << std::endl;

    const char* response = "Hello from the C++ Server!";
    send(client_socket, response, strlen(response), 0);
    std::cout << "Response sent to client." << std::endl;

    // 6. Close the sockets
    close(client_socket);
    close(server_fd);

    return 0;
}
``` 

Some points to be explained here. 

#### creating a socket
In this sentence:

```cpp
int server_fd = socket(AF_INET, SOCK_STREAM, 0);
```

It shows the "everything is a file" philosophy in Linux system. The integer represents a File Descriptor. File Descriptor Table contains the pointer to the resource, the returned integer is the index of that pointer in the table.

#### bind

```cpp
if (bind(server_fd, (struct sockaddr*)&server_addr, sizeof(server_addr)) < 0) {
        std::cerr << "Bind failed." << std::endl;
        return 1;
    }
```

`(struct sockaddr*)`: This is a Type Cast. `bind()` is designed to accept a generic "base class" struct called **sockaddr**. However, you are using a specific "child class" struct for IPv4 called sockaddr_in.

By adding `(struct sockaddr*)`, you are explicitly telling the compiler: "Trust me, take my IPv4 address package and temporarily treat it like a generic address package so the `bind()` function will accept it."

`sizeof(server_addr)` tells the kernel to read the exact amount of data starting from the `server_addr`.

If everything is valid, the OS updates its internal network tables. From this moment forward, if your computer's network card receives a TCP packet destined for Port 8080, the OS knows it belongs to your program's file descriptor.

#### listen

```cpp
// 3. Listen for incoming connections (max 3 pending connections in queue)
    if (listen(server_fd, 3) < 0) {
        std::cerr << "Listen failed." << std::endl;
        return 1;
    }
    std::cout << "Server is listening on port 8080..." << std::endl;
```

The second parameter (The Backlog Queue Size): This is the most important concept to understand about listen(). It dictates the maximum number of pending connections the operating system will hold in a queue for you.

When a client tries to connect to your server, the TCP "Three-Way Handshake" takes place. This handshake is handled entirely by the Operating System in the background, not by your C++ code.

When you call `accept()` in your C++ code (step 4 of the server flow): You pull the first person out of this line and start talking to them.

#### accept

```cpp
// 4. Accept a client connection
    struct sockaddr_in client_addr;
    socklen_t client_len = sizeof(client_addr);
    int client_socket = accept(server_fd, (struct sockaddr*)&client_addr, &client_len);
    if (client_socket < 0) {
        std::cerr << "Accept failed." << std::endl;
        return 1;
    }
    std::cout << "Client connected!" << std::endl;
```

- First, create a blank, empty struct. You are telling the operating system: "When someone connects, please fill this box with their IP address and Port number."

- Second, pull the first connected client out of the "waiting room" (the backlog queue we discussed in the `listen()` step).

    - `(struct sockaddr*)&client_addr`: You are passing a pointer to your blank "Caller ID" box. By the time this function finishes, the OS will have filled this box with the client's actual IP address.

- Notice that `accept()` returns a brand new integer: `client_socket`.

:::note
This introduces one of the most important concepts in TCP server programming: A connected server always has at least TWO types of sockets.

The Listening Socket (server_fd): This socket's only job is to stand at the front door and greet new people. It never sends or receives actual message data (like text or files).

The Connected Socket (client_socket): When accept() successfully connects you with a client, **the OS creates a brand new, private socket dedicated entirely to that specific client**. This new file descriptor is what you will use to read() and write() data.
:::

Once `accept()` returns this new socket, your original server_fd immediately goes back to listening for the next person in line.

#### receive & send data

```cpp
char buffer[1024] = {0};
int bytes_read = read(client_socket, buffer, sizeof(buffer));
std::cout << "Received from client: " << buffer << std::endl;

const char* response = "Hello from the C++ Server!";
send(client_socket, response, strlen(response), 0);
std::cout << "Response sent to client." << std::endl;
```

Once the connection is established, the client and server exchange information by writing to and reading from the dedicated socket file descriptor, using memory buffers to temporarily hold the transmitted byte streams.

### client

The client codes are similar with the server, and much simpler. We just focus on the different parts.

```cpp title="client.cpp"
#include <iostream>
#include <cstring>
#include <unistd.h>
#include <arpa/inet.h>

int main() {
    // 1. Create the socket
    int client_socket = socket(AF_INET, SOCK_STREAM, 0);
    if (client_socket == -1) {
        std::cerr << "Failed to create socket." << std::endl;
        return 1;
    }

    // Define the server's address we want to connect to
    struct sockaddr_in server_addr;
    server_addr.sin_family = AF_INET;
    server_addr.sin_port = htons(8080);

    // Convert IPv4 addresses from text to binary form ("127.0.0.1" is localhost)
    if (inet_pton(AF_INET, "127.0.0.1", &server_addr.sin_addr) <= 0) {
        std::cerr << "Invalid address or address not supported." << std::endl;
        return 1;
    }

    // 2. Connect to the server
    if (connect(client_socket, (struct sockaddr*)&server_addr, sizeof(server_addr)) < 0) {
        std::cerr << "Connection failed." << std::endl;
        return 1;
    }
    std::cout << "Connected to the server!" << std::endl;

    // 3. Send and Receive data
    const char* message = "Hello from the C++ Client!";
    send(client_socket, message, strlen(message), 0);
    std::cout << "Message sent to server." << std::endl;

    char buffer[1024] = {0};
    int bytes_read = read(client_socket, buffer, sizeof(buffer));
    std::cout << "Received from server: " << buffer << std::endl;

    // 4. Close the socket
    close(client_socket);

    return 0;
}
```

#### converting IPv4 Addresses

```cpp
if (inet_pton(AF_INET, "127.0.0.1", &server_addr.sin_addr) <= 0) {
        std::cerr << "Invalid address or address not supported." << std::endl;
        return 1;
    }
```

- `inet_pton` stands for "Presentation to Numeric".

- You give it the human-readable text string "127.0.0.1" (which is the universal address for "localhost" or "my own computer").

- The OS translates that string into raw binary and neatly packs it directly into your server_addr.sin_addr struct for you.

#### connect

```cpp
if (connect(client_socket, (struct sockaddr*)&server_addr, sizeof(server_addr)) < 0) {
    std::cerr << "Connection failed." << std::endl;
    return 1;
}
std::cout << "Connected to the server!" << std::endl;
```
This is the moment the client actually reaches out across the network.

When you call `connect()`, the operating system takes your target address and **initiates the TCP Three-Way Handshake with the server**.

If the server is currently running `listen()` and has room in its waiting queue, the handshake completes, and `connect()` returns 0, which represents success.

If the server is offline, if a firewall blocks it, or if you typed the wrong IP address, `connect()` will fail and return -1.

# epoll

In Linux, everything is a File Descriptor (FD). When a server accepts a network connection, that connection is assigned an FD. If a server has 10,000 connected users, it has 10,000 FDs open.

`epoll` is a Linux system call that allows a program to efficiently monitor multiple file descriptors to see if any of them are ready for Input/Output (I/O) operations, like reading or writing data.

`epoll` fixes this by changing how the kernel tracks FDs. It relies on an event-driven mechanism operating in $O(1)$ time complexity.Instead of scanning a list, epoll maintains a data structure directly inside the Linux kernel. When network data arrives at the hardware network card, the kernel immediately flags the specific FD associated with that data and moves it to a "ready list."When your application asks for an update, epoll doesn't scan anything. It simply returns the contents of the "ready list." If 5 FDs have data, it hands you those 5 FDs instantly.

To use epoll, a program uses three specific functions in C:

- `epoll_create()`: This tells the kernel to allocate a new epoll instance. The kernel creates a red-black tree data structure in kernel-space to store the FDs you want to monitor.

- `epoll_ctl()`: This is the control interface. You use it to add, modify, or remove FDs from the epoll instance. You do this once per connection. You don't have to constantly pass the FD back and forth to the kernel anymore.

- `epoll_wait()`: This is where the application pauses. It blocks the thread until at least one FD in the epoll instance triggers an event (like receiving data). It then returns an array containing only the FDs that are ready for I/O.

:::note
`epoll` shifted network programming from a polling model (constantly asking "Are any of these 10,000 FDs ready?") to an event-driven model ("Wake me up and give me the exact list of FDs that just became ready").

This is the underlying technology that allows modern software like Nginx, Node.js, and Redis to handle hundreds of thousands of concurrent connections on a single server without exhausting CPU resources.
:::
```cpp
#include <iostream>
#include <sys/epoll.h> // The epoll library
#include <unistd.h>    // For read(), close(), and STDIN_FILENO

int main() {
    // 1. Create the epoll instance
    // epoll_create1(0) is the modern equivalent of epoll_create()
    int epoll_fd = epoll_create1(0);
    if (epoll_fd == -1) {
        std::cerr << "Failed to create epoll instance\n";
        return 1;
    }

    // 2. Configure the specific file descriptor we want to monitor
    struct epoll_event event;
    event.events = EPOLLIN;               // We want to know when data is ready to be Read (INput)
    event.data.fd = STDIN_FILENO;         // Monitor standard input (FD 0)

    // Add STDIN to the epoll instance's internal watch list
    if (epoll_ctl(epoll_fd, EPOLL_CTL_ADD, STDIN_FILENO, &event) == -1) {
        std::cerr << "Failed to add file descriptor to epoll\n";
        close(epoll_fd);
        return 1;
    }

    // Array to hold the events that are actually ready when epoll wakes up
    const int MAX_EVENTS = 5;
    struct epoll_event ready_events[MAX_EVENTS];

    std::cout << "Program sleeping. Type something and press Enter to wake it up...\n";

    // 3. Wait for an event to happen
    // Arguments: epoll instance, array to fill, max events to return, timeout (-1 means wait forever)
    int num_ready = epoll_wait(epoll_fd, ready_events, MAX_EVENTS, -1);

    if (num_ready == -1) {
        std::cerr << "Error during epoll_wait\n";
        close(epoll_fd);
        return 1;
    }

    // 4. Process the ready file descriptors
    for (int i = 0; i < num_ready; i++) {
        if (ready_events[i].data.fd == STDIN_FILENO) {
            std::cout << "\nepoll triggered! Data is ready on File Descriptor: " 
                      << ready_events[i].data.fd << "\n";

            // Read the data to clear the buffer
            char buffer[128];
            ssize_t bytes_read = read(STDIN_FILENO, buffer, sizeof(buffer) - 1);
            
            if (bytes_read > 0) {
                buffer[bytes_read] = '\0'; // Null-terminate the string
                std::cout << "You typed: " << buffer;
            }
        }
    }

    // Clean up
    close(epoll_fd);
    return 0;
}
```

# The *Reactor* Pattern

The *Reactor* Pattern is a high-performance network architecture used by modern systems like Redis, Nginx, and Netty, often mentioned together with the *Proactor* pattern.

## The Core Philosophy

At its heart, the Reactor pattern is an event-driven architecture designed to handle multiple concurrent I/O operations efficiently. Instead of assigning a dedicated thread to wait on every single connection (which wastes immense system resources), the Reactor uses a non-blocking, "push-based" approach: it waits for the operating system to notify it that an event has occurred, and only then does it allocate resources to process it.

## The Three Key Components

The architecture relies on a strict division of labor:

- Reactor (The Dispatcher): The central hub. It runs in a continuous loop, listening for incoming events (like new connections or ready-to-read data) and routing them to the appropriate handlers.

- Acceptor: The greeter. When the Reactor detects a new client trying to connect, it routes the request to the Acceptor, which establishes the connection and sets up a Handler for it.

- Handler: The worker. Once a connection is established and data is ready, the Handler executes the actual business logic (reading data, processing it, and sending a response).

## The Engine Under the Hood: I/O Multiplexing

The Reactor pattern cannot achieve high performance purely on its own—it relies heavily on the operating system's I/O Multiplexing capabilities (such as epoll in Linux, kqueue in macOS, or select/poll in older systems).

`epoll` is the underlying mechanism that allows a single Reactor thread to monitor tens of thousands of connections simultaneously, notifying the Reactor the exact moment a specific connection has data ready to be processed.

## The Architectural Evolution
As system demands scale, the pattern is typically implemented in one of three ways:

> “单 Reactor 单线程只有一个线程在跑所有的 Handler，而单 Reactor 多线程是用一个线程池并发跑所有的 Handler。”

- Single Reactor, Single Thread:

    Everything (listening, accepting, reading, processing) happens in one thread.

    Best for: Extremely fast, CPU-bound operations where business logic doesn't block (e.g., early Redis).

- Single Reactor, Multi-Thread:

    The Reactor handles the network I/O, but offloads the heavy business logic to a separate Worker Thread Pool.

    Best for: General use cases, preventing slow database queries from blocking new network connections.

-  Main-Sub Reactor, Multi-Thread (The Master-Worker Model):

    A Main Reactor dedicated solely to accepting new connections. It immediately passes these connections to one of several Sub Reactors, which handle the read/write I/O. The actual computation is still passed to a Thread Pool.

    Best for: Massive scale and enterprise-grade performance. This is the gold standard used by Nginx, Netty, and Kafka.

## The Ultimate Takeaway
The true superpower of the Reactor pattern is decoupling. By separating the act of waiting for network data from the act of processing that data, it ensures that your CPU is always doing useful work rather than sitting idle. This is the foundational secret behind modern servers handling millions of concurrent connections with minimal hardware.