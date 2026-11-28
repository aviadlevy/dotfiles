# Fresh-machine test for install.sh + chezmoi apply. See tests/docker/run.sh.
FROM ubuntu:24.04
# Only what README says to install first (git, curl) plus Homebrew-on-Linux's documented prereqs.
RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
      git curl ca-certificates sudo build-essential procps file locales \
 && locale-gen en_US.UTF-8 && rm -rf /var/lib/apt/lists/*
# Homebrew refuses to run as root: a passwordless-sudo user, like a fresh laptop account.
RUN useradd -m -s /bin/bash tester && echo 'tester ALL=(ALL) NOPASSWD:ALL' > /etc/sudoers.d/tester
USER tester
WORKDIR /home/tester
ENV LANG=en_US.UTF-8 NONINTERACTIVE=1
# Layer cache: Homebrew itself installs once; run.sh then runs install.sh in full on every test.
RUN /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
