FROM node:16-alpine3.14

ENV HOME=/home/oa-deploy
WORKDIR $HOME
COPY ./ $HOME

RUN npm install -g npm@8 \
    && npm update \
    && npm install

CMD npm run lint
