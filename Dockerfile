ARG NODE_ENV=production
ARG APP_ENV=production

FROM --platform=linux/amd64 node:lts-alpine AS builder

ARG NODE_ENV
ENV NODE_ENV=$NODE_ENV
ARG APP_ENV
ENV APP_ENV=$APP_ENV

RUN apk add coreutils

WORKDIR /app

COPY package*.json .eslintrc.yml tsconfig.json tsconfig.build.json /app/
RUN npm ci --production

COPY ./ /app/


FROM --platform=linux/amd64 node:lts-alpine AS prod

ARG NODE_ENV
ENV NODE_ENV=$NODE_ENV
ARG APP_ENV
ENV APP_ENV=$APP_ENV

WORKDIR /app

COPY ./ /app/
COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/dist /app/dist

ENTRYPOINT [ "npm" ]
CMD [ "run", "start" ]
