#include <heapmap/log.hpp>

#include <atomic>
#include <cerrno>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <mutex>

#include <fmt/core.h>

namespace {
static std::atomic_bool ready = false;
static thread_local int busy = 0;
static std::mutex lock;

// The parameters below can be edited with environment variables.
FILE* logFile = fopen("heapmap.log", "w");

struct Initialization {
    Initialization() {
        if (const char* env = std::getenv("HEAPMAP_LOG_FILENAME")) {
            if ((logFile = fopen(env, "w")) == nullptr) {
                fmt::println(stderr, "Unexpected error (fopen): {}.", std::strerror(errno));
                std::abort();
            }
        }

        ready = true;
    }

    ~Initialization() {
        std::lock_guard<std::mutex> guard(lock);
        ready = false;

        if (fclose(logFile) != 0) {
            fmt::println(stderr, "Unexpected error (fclose): {}.", std::strerror(errno));
            std::abort();
        }
    }
};

static Initialization _;

enum class Event {
    Allocation = 1,
    Free = 2,
    Checkpoint = 3,
};

// All records are 3 bytes, though some fields may not be set.
struct Record {
    const Event event;
    const std::size_t size;
    const void* pointer;
};
} // namespace

void heapmap::log::allocation(std::size_t size, void* pointer) {
    if (!ready || busy) {
        return;
    }

    ++busy;
    {
        std::lock_guard<std::mutex> guard(lock);
        const auto record = Record(Event::Allocation, size, pointer);
        std::fwrite(&record, sizeof(Record), 1, logFile);
    }
    --busy;
}

void heapmap::log::free(void* pointer) {
    if (!ready || busy || pointer == nullptr) {
        return;
    }

    ++busy;
    {
        std::lock_guard<std::mutex> guard(lock);
        const auto record = Record(Event::Free, 0, pointer);
        std::fwrite(&record, sizeof(Record), 1, logFile);
    }
    --busy;
}

void heapmap::log::checkpoint() {
    if (!ready || busy) {
        return;
    }

    ++busy;
    {
        std::lock_guard<std::mutex> guard(lock);
        const auto record = Record(Event::Checkpoint, 0, nullptr);
        std::fwrite(&record, sizeof(Record), 1, logFile);
    }
    --busy;
}
