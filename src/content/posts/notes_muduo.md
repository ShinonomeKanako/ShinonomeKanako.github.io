---
title: Notes on Muduo
published: 2026-04-26
description: ''
image: ''
tags: [tech]
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
```C++
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
```C++
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
```C++
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
### unique_pointer
What it means: "I am the only one who owns this memory."
```C++
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
```C++
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
```C++
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