FROM public.ecr.aws/bitnami/node:16.20.0 AS build
WORKDIR /usr/src/app
COPY package.json ./
RUN yarn  2>/dev/null
COPY . .
RUN yarn build:prod  2>/dev/null

FROM public.ecr.aws/nginx/nginx:1.21
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /usr/src/app/dist /usr/share/nginx/html/app
