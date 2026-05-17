{pkgs}: {
  deps = [
    pkgs.chromium
    pkgs.alsa-lib
    pkgs.libxkbcommon
    pkgs.expat
    pkgs.mesa
    pkgs.xorg.libxcb
    pkgs.xorg.libXrandr
    pkgs.xorg.libXfixes
    pkgs.xorg.libXext
    pkgs.xorg.libXdamage
    pkgs.xorg.libXcomposite
    pkgs.xorg.libX11
    pkgs.libdrm
    pkgs.cups
    pkgs.atk
    pkgs.nspr
    pkgs.nss
    pkgs.glib
    pkgs.unzip
  ];
}
