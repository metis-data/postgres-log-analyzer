FROM --platform=linux/amd64 node:lts-alpine AS builder

RUN apk add coreutils

WORKDIR /app

ARG PORT=6000
ENV PORT=${PORT}

COPY package*.json .eslintrc.yml tsconfig.json tsconfig.build.json /app/
RUN npm ci --production

COPY ./ /app/

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

ARG APP_ENV=production
ENV APP_ENV=${APP_ENV}

FROM --platform=linux/amd64 node:lts-alpine AS prod

WORKDIR /app

ARG APP_VERSION

COPY ./ /app/
COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/dist /app/dist

ENV APP_VERSION=${APP_VERSION}

ENTRYPOINT [ "npm" ]
CMD [ "run", "start" ]
