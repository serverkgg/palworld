FROM ubuntu:24.04

ARG BRIDGE_VERSION
ARG PROTON_VERSION=10-34
ARG PROTON_SHA512=9fd0b2cfbd501c0b5c892239c392c7283a029b5e5d5a77d3f85b0ce190d555456241a18eebca16b53f094b403499201c13550a3f0b9b365e1a5eb5737cbb7303
ARG UE4SS_VERSION=2281fa31
ARG UE4SS_SHA512=cdc3d244ce156a37f237d563e717be6a2ad696dde41bd29d0726308c441d796a9cc2a45096e967af6e62f0070d21ddea6e5185c2dc7d2816db86d26f80288c99
ARG PALSCHEMA_VERSION=0.6.71
ARG PALSCHEMA_SHA512=329db36a1edd8728a74a6209a5533cd2aa1b9cb0171de088ac2001b07136225db700f41d925455485f0486c490aa720d72dd6f8e65bf3b63f9e8760ebe96574c

LABEL gg.serverk.bridge.version="${BRIDGE_VERSION}"

LABEL org.opencontainers.image.source="https://github.com/serverkgg/palworld"
LABEL gg.serverk.game="palworld"
LABEL gg.serverk.proton="GE-Proton${PROTON_VERSION}"
LABEL gg.serverk.ue4ss="${UE4SS_VERSION}"
LABEL gg.serverk.palschema="${PALSCHEMA_VERSION}"

RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends \
      tini ca-certificates curl util-linux procps tzdata locales python3 \
      lib32gcc-s1 lib32stdc++6 lib32z1 libfreetype6 libvulkan1 xvfb xauth; \
    rm -rf /var/lib/apt/lists/*; \
    locale-gen en_US.UTF-8; \
    if getent passwd 1000 > /dev/null; then \
      userdel -r "$(getent passwd 1000 | cut -d: -f1)"; \
    fi; \
    groupadd -g 1000 container; \
    useradd -M -d /home/container -u 1000 -g 1000 -s /usr/sbin/nologin container; \
    mkdir -p /home/container /serverk/run /opt/serverk /opt/steamcmd; \
    curl -fsSL https://steamcdn-a.akamaihd.net/client/installer/steamcmd_linux.tar.gz \
      | tar -xz -C /opt/steamcmd; \
    chmod -R a+rX /opt/steamcmd; \
    tr -d '-' < /proc/sys/kernel/random/uuid > /etc/machine-id

RUN set -eux; \
    mkdir -p /opt/proton; \
    curl -fsSL -o /tmp/proton.tar.gz \
      "https://github.com/GloriousEggroll/proton-ge-custom/releases/download/GE-Proton${PROTON_VERSION}/GE-Proton${PROTON_VERSION}.tar.gz"; \
    echo "${PROTON_SHA512}  /tmp/proton.tar.gz" | sha512sum -c -; \
    tar -xzf /tmp/proton.tar.gz --strip-components=1 -C /opt/proton; \
    rm -f /tmp/proton.tar.gz; \
    rm -rf /opt/proton/files/share/wine/mono /opt/proton/files/share/wine/gecko \
      /opt/proton/files/share/espeak-ng-data /opt/proton/files/share/libtashkeel_model.ort; \
    chmod -R a+rX /opt/proton; \
    test -x /opt/proton/proton

RUN set -eux; \
    mkdir -p /opt/serverk/ue4ss; \
    curl -fsSL -o /tmp/ue4ss.zip \
      "https://github.com/Okaetsu/RE-UE4SS/releases/download/${UE4SS_VERSION}/UE4SS-Palworld-g${UE4SS_VERSION}.zip"; \
    echo "${UE4SS_SHA512}  /tmp/ue4ss.zip" | sha512sum -c -; \
    curl -fsSL -o /tmp/palschema.zip \
      "https://github.com/Okaetsu/PalSchema/releases/download/${PALSCHEMA_VERSION}/PalSchema_${PALSCHEMA_VERSION}.zip"; \
    echo "${PALSCHEMA_SHA512}  /tmp/palschema.zip" | sha512sum -c -; \
    python3 -m zipfile -e /tmp/ue4ss.zip /opt/serverk/ue4ss; \
    python3 -m zipfile -e /tmp/palschema.zip /opt/serverk/ue4ss/ue4ss/Mods; \
    rm -f /tmp/ue4ss.zip /tmp/palschema.zip; \
    sed -i 's/^Keybinds : 1/Keybinds : 0/' /opt/serverk/ue4ss/ue4ss/Mods/mods.txt; \
    chmod -R a+rX /opt/serverk/ue4ss; \
    test -f /opt/serverk/ue4ss/dwmapi.dll; \
    test -f /opt/serverk/ue4ss/ue4ss/Mods/PalSchema/dlls/main.dll

ENV LANG=en_US.UTF-8 \
    LC_ALL=en_US.UTF-8 \
    TZ=UTC \
    HOME=/home/container

COPY image/palworld-start /opt/serverk/palworld-start

RUN chmod 0755 /opt/serverk/palworld-start

COPY dist/bridge /serverk/bridge

RUN chmod 0755 /serverk/bridge

WORKDIR /home/container

ENTRYPOINT ["/usr/bin/tini", "--", "/serverk/bridge"]
