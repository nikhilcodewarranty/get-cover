FROM node:alpine
WORKDIR /getCover/src/app
COPY ./package.json ./
COPY ./package-lock.json ./
COPY ./swagger.json ./
RUN npm install
COPY ./.env ./
COPY ./db.js ./
EXPOSE 3000
