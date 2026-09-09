FROM ubuntu:24.04 AS ue4ss

ARG UE4SS_REPOSITORY=https://github.com/BlackBookOfficial/ue4ss-linux-palworld.git
ARG UE4SS_BRANCH=linux-native
ARG UE4SS_COMMIT=2397c7b1ce2841fd6526b8d8110cd008c90a6316

ENV DEBIAN_FRONTEND=noninteractive \
    CARGO_HOME=/opt/rust/cargo \
    RUSTUP_HOME=/opt/rust/rustup \
    PATH=/opt/rust/cargo/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends \
      cmake ninja-build pkg-config git ca-certificates curl binutils \
      libx11-dev libxrandr-dev libxinerama-dev libxcursor-dev libxi-dev \
      libgl-dev libegl-dev libgles-dev \
      gcc g++; \
    rm -rf /var/lib/apt/lists/*; \
    curl -fsSL https://sh.rustup.rs \
      | sh -s -- -y --no-modify-path --profile minimal --default-toolchain stable --component rustfmt; \
    cargo --version; \
    rustc --version

WORKDIR /src

RUN set -eux; \
    git init -q .; \
    git remote add origin "${UE4SS_REPOSITORY}"; \
    git fetch --depth 1 origin "${UE4SS_COMMIT}"; \
    git checkout -q FETCH_HEAD

RUN --mount=type=cache,target=/opt/rust/cargo/registry,sharing=locked \
    --mount=type=cache,target=/opt/rust/cargo/git,sharing=locked \
    --mount=type=cache,target=/src/build_linux,sharing=locked \
    set -eux; \
    export CC=gcc CXX=g++; \
    cmake -B build_linux -G Ninja \
      -DCMAKE_BUILD_TYPE=Game__Dev__Linux64 \
      -DUE4SS_GUI_ENABLED=ON \
      -DUE4SS_INPUT_ENABLED=OFF \
      -DUE4SS_PROFILERS=OFF \
      -Wno-dev; \
    cmake --build build_linux --target UE4SS; \
    built="$(find build_linux -name libUE4SS.so -type f | head -1)"; \
    test -n "${built}"; \
    mkdir -p /opt/ue4ss; \
    cp "${built}" /opt/ue4ss/libUE4SS.so; \
    strip --strip-debug /opt/ue4ss/libUE4SS.so; \
    cp assets/UE4SS-settings.ini /opt/ue4ss/; \
    cp assets/palworld/MemberVariableLayout.ini /opt/ue4ss/; \
    cp -r assets/Mods /opt/ue4ss/Mods; \
    { \
      echo "UE4SS Linux native build for the serverk palworld image"; \
      echo "Repository: ${UE4SS_REPOSITORY}"; \
      echo "Branch: ${UE4SS_BRANCH}"; \
      echo "Commit: $(git rev-parse HEAD)"; \
      echo "Build Type: Game__Dev__Linux64"; \
      echo "GUI: Enabled"; \
      echo "Input: Disabled"; \
      echo "Profilers: Disabled"; \
      echo "Compiler: $(g++ --version | head -1)"; \
      echo "Build Host: ubuntu-24.04 (x86_64)"; \
      echo "Build Date: $(date -u +'%Y-%m-%d %H:%M:%S UTC')"; \
    } > /opt/ue4ss/BUILD_INFO.txt; \
    chmod -R a+rX /opt/ue4ss; \
    ls -la /opt/ue4ss

FROM ubuntu:24.04

ARG BRIDGE_VERSION

LABEL gg.serverk.bridge.version="${BRIDGE_VERSION}"

LABEL org.opencontainers.image.source="https://github.com/serverkgg/palworld"
LABEL gg.serverk.game="palworld"

RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends \
      tini ca-certificates curl util-linux tzdata locales \
      lib32gcc-s1 lib32stdc++6 libstdc++6 libx11-6; \
    rm -rf /var/lib/apt/lists/*; \
    locale-gen en_US.UTF-8; \
    if getent passwd 1000 > /dev/null; then \
      userdel -r "$(getent passwd 1000 | cut -d: -f1)"; \
    fi; \
    groupadd -g 1000 container; \
    useradd -M -d /home/container -u 1000 -g 1000 -s /usr/sbin/nologin container; \
    mkdir -p /home/container /serverk/run /opt/steamcmd; \
    curl -fsSL https://steamcdn-a.akamaihd.net/client/installer/steamcmd_linux.tar.gz \
      | tar -xz -C /opt/steamcmd; \
    chmod -R a+rX /opt/steamcmd

COPY --from=ue4ss /opt/ue4ss /opt/ue4ss

ENV LANG=en_US.UTF-8 \
    LC_ALL=en_US.UTF-8 \
    TZ=UTC \
    HOME=/home/container

COPY dist/bridge /serverk/bridge

RUN chmod 0755 /serverk/bridge

WORKDIR /home/container

ENTRYPOINT ["/usr/bin/tini", "--", "/serverk/bridge"]
