FROM debian:buster

LABEL maintainer "Gabriel Gazola Milan <gabriel.gazola@poli.ufrj.br>"

# Initial setup
ENV LC_ALL C.UTF-8
ENV LANG en_US.UTF-8
ENV LANGUAGE en_US:en
ENV TERM screen
USER root
SHELL [ "/bin/bash", "-c" ]
RUN rm /bin/sh && ln -s /bin/bash /bin/sh

# Dependencies
RUN apt update && apt upgrade -y && apt install -y curl git
RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.35.3/install.sh | bash
RUN source /root/.bashrc && nvm install 11.10.0
RUN source /root/.bashrc && npm install -g npm@latest

# Get bot
RUN mkdir -p /code && cd /code && git clone https://github.com/bmino/binance-triangle-arbitrage bot

# Install bot dependencies
RUN source /root/.bashrc && cd /code/bot && npm install

# Set command
CMD source /root/.bashrc && cd /code/bot && npm start
