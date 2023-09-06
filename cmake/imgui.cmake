include(FetchContent)

FetchContent_Declare(
    imgui
    GIT_REPOSITORY https://github.com/ocornut/imgui.git
    GIT_TAG c6e0284ac58b3f205c95365478888f7b53b077e2 # v1.89.9
)

message(STATUS "Downloading ImGui")
FetchContent_Populate(imgui)
file(GLOB IMGUI_SOURCES ${imgui_SOURCE_DIR}/*.cpp ${imgui_SOURCE_DIR}/*.h)
list(APPEND IMGUI_SOURCES ${imgui_SOURCE_DIR}/misc/cpp/imgui_stdlib.cpp)
add_library(imgui STATIC ${IMGUI_SOURCES})
target_include_directories(imgui PUBLIC ${imgui_SOURCE_DIR})
