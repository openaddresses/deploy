FROM node:24-alpine

ENV HOME=/home/oa-deploy
WORKDIR $HOME
COPY ./ $HOME

RUN npm install

CMD npm run lint
