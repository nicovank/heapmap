#include <cstddef>

#include <mimalloc.h>

#include <heapmap/log.hpp>

extern "C" void* malloc(std::size_t size) {
    void* pointer = mi_malloc(size);
    heapmap::log::allocation(size, pointer);
    return pointer;
}

extern "C" void free(void* ptr) {
    heapmap::log::free(ptr);
    mi_free(ptr);
}

extern "C" void* calloc(std::size_t nmemb, std::size_t size) {
    void* pointer = mi_calloc(nmemb, size);
    heapmap::log::allocation(nmemb * size, pointer);
    return pointer;
}

extern "C" void* realloc(void* ptr, std::size_t size) {
    heapmap::log::free(ptr);
    ptr = mi_realloc(ptr, size);
    heapmap::log::allocation(size, ptr);
    return ptr;
}

extern "C" void* reallocarray(void* ptr, std::size_t nmemb, std::size_t size) {
    heapmap::log::free(ptr);
    ptr = mi_reallocarray(ptr, nmemb, size);
    heapmap::log::allocation(nmemb * size, ptr);
    return ptr;
}

extern "C" int posix_memalign(void** memptr, std::size_t alignment, std::size_t size) {
    int result = mi_posix_memalign(memptr, alignment, size);
    heapmap::log::allocation(size, *memptr);
    return result;
}

extern "C" void* aligned_alloc(std::size_t alignment, std::size_t size) {
    void* pointer = mi_aligned_alloc(alignment, size);
    heapmap::log::allocation(size, pointer);
    return pointer;
}
