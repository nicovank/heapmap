#include <cstddef>

namespace heapmap::log {
void allocation(std::size_t size, void* pointer);
void free(void* pointer);
void checkpoint();
} // namespace heapmap::log
