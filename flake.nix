# A nix flake that sets up a complete development environment for the Matrix Spec.
#
# You must have already installed nix (https://nixos.org) on your system to use this.
# nix can be installed on Linux or MacOS; NixOS is not required. Windows is not
# directly supported, but nix can be installed inside of WSL2 or even Docker
# containers. Please refer to https://nixos.org/download for details.
#
# You must also enable support for flakes in Nix. See the following for how to
# do so permanently: https://nixos.wiki/wiki/Flakes#Enable_flakes
#
# Usage:
#
# With nix installed, navigate to the directory containing this flake and run
# `nix develop --impure`.
#
# You should now be dropped into a new shell with all programs and dependencies
# available to you!
#
# All state is stored in .devenv/state. Deleting a file from here and then
# re-entering the shell will recreate these files from scratch.
#
# You can exit the development shell by typing `exit`, or using Ctrl-D.
#
# If you would like this development environment to activate automatically
# upon entering this directory in your terminal, first install `direnv`
# (https://direnv.net/). Then run `echo 'use flake . --impure' >> .envrc` at
# the root of the Synapse repo. Finally, run `direnv allow .` to allow the
# contents of '.envrc' to run every time you enter this directory. Voilà!

{
  inputs = {
    # Use the master/unstable branch of nixpkgs for the latest packages.
    nixpkgs.url = "github:NixOS/nixpkgs/master";
    # Output a development shell for x86_64/aarch64 Linux/Darwin (MacOS).
    systems.url = "github:nix-systems/default";
    # A development environment manager built on Nix. See https://devenv.sh.
    devenv.url = "github:cachix/devenv/main";
  };

  outputs = { self, nixpkgs, devenv, systems, ... } @ inputs:
    let
      forEachSystem = nixpkgs.lib.genAttrs (import systems);
    in {
      devShells = forEachSystem (system:
        let
          pkgs = nixpkgs.legacyPackages.${system};
        in {
          # Everything is configured via devenv - a nix module for creating declarative
          # developer environments. See https://devenv.sh/reference/options/ for a list
          # of all possible options.
          default = devenv.lib.mkShell {
            inherit inputs pkgs;
            modules = [
              {
                # Make use of the Starship command prompt when this development environment
                # is manually activated (via `nix develop --impure`).
                # See https://starship.rs/ for details on the prompt itself.
                starship.enable = true;

                # Configure packages to install.
                # Search for package names at https://search.nixos.org/packages?channel=unstable
                packages = with pkgs; [
                  # For building the spec as a static site.
                  hugo
                ];

                # Install node and npm. The hugo theme we use, 'docsy', has some node dependencies.
                # In addition, some of the matrix-spec development scripts are written in nodejs.
                languages.javascript.enable = true;
                # Run `npm install` on shell initialisation if package-lock.json
                # or the node version has changed.
                languages.javascript.npm.install.enable = true;
              }
            ];
          };
        });
    };
}