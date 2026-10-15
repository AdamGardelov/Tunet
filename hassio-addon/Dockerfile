ARG BUILD_VERSION

# Build only the reviewed source revision from our fork.
# Update this commit deliberately after reviewing upstream changes.
FROM node:26-alpine AS builder
RUN apk add --no-cache git python3 make g++ \
 && set -eux \
 && SOURCE_COMMIT="910f9d180fd86c884e46798400afb967f7da6734" \
 && git init /src \
 && git -C /src remote add origin https://github.com/AdamGardelov/Tunet.git \
 && git -C /src fetch --depth=1 origin "${SOURCE_COMMIT}" \
 && git -C /src checkout --detach FETCH_HEAD \
 && test "$(git -C /src rev-parse HEAD)" = "${SOURCE_COMMIT}" \
 && rm -rf /src/.git \
 && cd /src \
 && npm ci \
 && case "$(uname -m)" in \
      aarch64) npm install --no-save --package-lock=false @rolldown/binding-linux-arm64-musl@1.2.12 ;; \
      x86_64) npm install --no-save --package-lock=false @rolldown/binding-linux-x64-musl@1.2.12 ;; \
      *) echo "Unsupported build architecture: $(uname -m)" >&2; exit 1 ;; \
    esac \
 && SKIP_POSTBUILD=1 npm run build

# Production image
FROM ghcr.io/hassio-addons/base:21.0.0
ARG BUILD_VERSION
ARG BUILD_ARCH
LABEL \
	io.hass.version="${BUILD_VERSION}" \
	io.hass.type="app" \
	io.hass.arch="${BUILD_ARCH}"

RUN apk add --no-cache nodejs npm python3 make g++

WORKDIR /app

COPY --from=builder /src/dist ./dist
COPY --from=builder /src/server ./server
COPY --from=builder /src/package.json .
COPY --from=builder /src/package-lock.json .

RUN npm ci --omit=dev \
 && apk del python3 make g++

COPY run.sh /run.sh
RUN chmod a+x /run.sh

CMD [ "/run.sh" ]
