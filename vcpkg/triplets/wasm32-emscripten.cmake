set(VCPKG_ENV_PASSTHROUGH_UNTRACKED EMSCRIPTEN_ROOT EMSDK PATH KRKR2_WEB_ASYNC_MODE)

set(VCPKG_TARGET_ARCHITECTURE wasm32)
set(VCPKG_CRT_LINKAGE dynamic)
set(VCPKG_LIBRARY_LINKAGE static)
set(VCPKG_CMAKE_SYSTEM_NAME Emscripten)
set(VCPKG_BUILD_TYPE release)

# Exception/SjLj ABI must match the final engine link, which is selected by
# KRKR2_WEB_ASYNC_MODE (see root CMakeLists.txt):
#   jspi     -> ports use native Wasm exceptions + Wasm SjLj (-fwasm-exceptions).
#   asyncify -> ports use emscripten legacy EH + legacy SjLj. ASYNCIFY=1
#               rejects -fwasm-exceptions outright, and SUPPORT_LONGJMP=wasm
#               is rejected together with DISABLE_EXCEPTION_CATCHING=0, so the
#               only consistent port ABI for the universal build is the legacy
#               one. Compile-time SjLj transformation is enabled explicitly so
#               setjmp()-using ports (cairo, libpng, ffmpeg, ...) match the
#               link-time SUPPORT_LONGJMP=emscripten default.
if(DEFINED ENV{KRKR2_WEB_ASYNC_MODE} AND "$ENV{KRKR2_WEB_ASYNC_MODE}" STREQUAL "jspi")
    list(APPEND VCPKG_CMAKE_CONFIGURE_OPTIONS
        "-DCMAKE_C_FLAGS=-pthread -fwasm-exceptions"
        "-DCMAKE_CXX_FLAGS=-pthread -fwasm-exceptions"
    )
else()
    list(APPEND VCPKG_CMAKE_CONFIGURE_OPTIONS
        "-DCMAKE_C_FLAGS=-pthread -sSUPPORT_LONGJMP=emscripten"
        "-DCMAKE_CXX_FLAGS=-pthread -sSUPPORT_LONGJMP=emscripten"
    )
endif()

if(DEFINED ENV{EMSDK})
    set(VCPKG_CHAINLOAD_TOOLCHAIN_FILE "$ENV{EMSDK}/upstream/emscripten/cmake/Modules/Platform/Emscripten.cmake")
elseif(DEFINED ENV{EMSCRIPTEN})
    set(VCPKG_CHAINLOAD_TOOLCHAIN_FILE "$ENV{EMSCRIPTEN}/cmake/Modules/Platform/Emscripten.cmake")
endif()
