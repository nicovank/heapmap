cmake_minimum_required(VERSION 3.16)

project(microperf)

include(FetchContent)
include(CheckIPOSupported)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_POSITION_INDEPENDENT_CODE ON)

check_ipo_supported(RESULT IPO_SUPPORTED)
if(IPO_SUPPORTED)
    message(STATUS "IPO/LTO supported")
else()
    message(STATUS "IPO/LTO not supported")
endif()

FetchContent_Declare(
    fmt
    GIT_REPOSITORY https://github.com/fmtlib/fmt.git
    GIT_TAG f5e54359df4c26b6230fc61d38aa294581393084 # 10.1.1
)

FetchContent_Declare(
    mimalloc
    GIT_REPOSITORY https://github.com/microsoft/mimalloc.git
    GIT_TAG 43ce4bd7fd34bcc730c1c7471c99995597415488 # v2.1.2
)

message(STATUS "Downloading and configuring {fmt}")
FetchContent_MakeAvailable(fmt)

add_library(heapmap-log SHARED src/log.cpp)
set_property(TARGET heapmap-log PROPERTY INTERPROCEDURAL_OPTIMIZATION ${IPO_SUPPORTED})
if(MSVC)
    target_compile_options(heapmap-log PRIVATE /W4 /WX)
else()
    target_compile_options(heapmap-log PRIVATE -Wall -Wextra -Wpedantic -Werror)
endif()
target_include_directories(heapmap-log PRIVATE include)
target_link_libraries(heapmap-log PRIVATE fmt)

if(NOT MSVC)
    message(STATUS "Downloading and configuring mimalloc")
    set(MI_OVERRIDE OFF)
    FetchContent_MakeAvailable(mimalloc)

    add_library(heapmap-logger SHARED src/logger.cpp)
    set_property(TARGET heapmap-logger PROPERTY INTERPROCEDURAL_OPTIMIZATION ${IPO_SUPPORTED})
    target_compile_options(heapmap-logger PRIVATE -Wall -Wextra -Wpedantic -Werror)
    target_include_directories(heapmap-logger PRIVATE include)
    target_link_libraries(heapmap-logger PRIVATE heapmap-log)
    target_link_libraries(heapmap-logger PRIVATE mimalloc-static)
endif()
