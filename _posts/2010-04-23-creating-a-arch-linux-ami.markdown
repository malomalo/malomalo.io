---
title: Creating an Arch Linux AMI
author: Jonathan Bracy
layout: post
---

The following instructions will cover how to create an Arch Linux EC2 AMI from
scratch. This tutorial assumes that you have an Amazon EC2 account, and the EC2
tools installed.

Boot up an Ubuntu AMI
---------------------
Depending on where and what type of EC2 instances you  will be running will
change which AMI you should use. I'm using `ami-55739e3c` because it's located
in the `us-east-1` region and it's a 64-bit image.

[alestic.com](http://alestic.com/) contains of list of Ubuntu AMIs to use.

If you plan to use 32-bit instances (`c1.medium` and `m1.small`) you will need
to create a 32-bit AMI. Choose a 32-bit Ubuntu AMI and in most of the examples
change `x86_64` to `i686`.

64-bit AMIs will run on the following instance types: `m1.large`, `m1.xlarge`,
`c1.xlarge`, `m2.xlarge`, `m2.2xlarge`, and `m2.4xlarge`

It is possible to move your AMI to another region once it is built.

Preparing Ubuntu
----------------

Login as root on the Ubuntu AMI if you are not already:
{% highlight bash %}
sudo su
{% endhighlight %}

Enable multiverse in source.list
{% highlight bash %}
sed -i 's/karmic main universe/karmic main universe multiverse/' /etc/apt/sources.list
apt-get update
{% endhighlight %}

Install Pacman
{% highlight bash %}
apt-get install xz-utils --force-yes
apt-get --yes install libssl-dev

ln -s /usr/lib/libssl.so /usr/lib/libssl.so.1.0.0
ln -s /usr/lib/libcrypto.so /usr/lib/libcrypto.so.1.0.0

cd /
wget ftp://ftp.archlinux.org/core/os/x86_64/libarchive-\*.pkg.tar.*
wget ftp://ftp.archlinux.org/core/os/x86_64/libfetch-\*.pkg.tar.*
wget ftp://ftp.archlinux.org/core/os/x86_64/pacman-\*.pkg.tar.*
for f in /*-*.pkg.tar.*
do
  tar xzf $f
done

cat > /etc/pacman.d/mirrorlist <<\EOF
Server = http://schlunix.org/archlinux/$repo/os/x86_64
Server = http://archlinux.umflint.edu/$repo/os/x86_64
Server = http://mirror.twilightlair.net/arch/$repo/os/x86_64
EOF
{% endhighlight %}

Prepare the Arch Linux chroot
-----------------------------

Create a partition to install Arch on:
{% highlight bash %}
apt-get --yes install xfsprogs # to get xfs

mkdir /arch
mkfs.xfs -f /dev/sdc
mount /dev/sdc /arch
{% endhighlight %}

Install Arch on the new partition
{% highlight bash %}
mkdir -p /arch/var/lib/pacman
pacman --noconfirm -Sy -r /arch
pacman --noconfirm -S base -r /arch
{% endhighlight %}

Prepare chroot
{% highlight bash %}
mount /dev/ /arch/dev/ --bind
mount /sys/ /arch/sys/ --bind
mount /proc/ /arch/proc/ --bind

cp /etc/resolv.conf /arch/etc/

cp -R /lib/modules/2.6.31-302-ec2 /arch/lib/modules/
{% endhighlight %}

Enter the chroot and finish the install
---------------------------------------

Enter chroot
{% highlight bash %}
chroot /arch
{% endhighlight %}

Setup locales
{% highlight bash %}
cat >/etc/locale.gen <<\EOF
en_US.UTF-8 UTF-8  
en_US ISO-8859-1
EOF

locale-gen
{% endhighlight %}

Create fstab
{% highlight bash %}
cat >/etc/fstab <<\EOF
# /etc/fstab: static file system information.
# <file system>                         <mount point>   <type>  <options>       <dump>  <pass>
proc                                    /proc           proc    defaults        0       0
/dev/sda3                               None            swap    defaults        0       0
/dev/sda1                               /               ext3    defaults        0       0
/dev/sda2                               /mnt            ext3    defaults        0       0
EOF
{% endhighlight %}

Uncomment all Arch Linux mirrors in your country.
{% highlight bash %}
vi /etc/pacman.d/mirrorlist # uncoment mirrors in your country
{% endhighlight %}

At this point I recommend you rank your mirrors by speed. Information on how
to do this is located on the [Arch Linux Wiki](http://wiki.archlinux.org/index.php/Beginners%27_Guide#.2Fetc.2Fpacman.d.2Fmirrorlist)

Install OpenSSH so we can SSH into our AMI
{% highlight bash %}
pacman --noconfirm -S openssh

# add sshd in DAEMONS array
sed -i 's/netfs crond)/netfs crond sshd)/' /etc/rc.conf

# enable remote access
cat >/etc/hosts.allow <<\EOF
sshd: ALL: ALLOW
EOF
{% endhighlight %}


On boot we need to grab the public key to allow ssh and run any user data if
available

{% highlight bash %}
pacman --noconfirm -S curl

cat >/etc/rc.local <<\EOF
mkdir -p /root/.ssh
curl --retry 3 --retry-delay 5 --silent --fail -o /root/.ssh/authorized_keys http://169.254.169.254/1.0/meta-data/public-keys/0/openssh-key

if curl --retry 3 --retry-delay 5 --silent --fail -o /root/user-data http://169.254.169.254/1.0/user-data; then
   bash /root/user-data
fi
rm -f /root/user-data
EOF
{% endhighlight %}

exit chroot
{% highlight bash %}
exit
{% endhighlight %}

Setup EC2 Tools
---------------

Install EC2 tools and EC2-AMI tools
{% highlight bash %}
apt-get --yes install ec2-api-tools ec2-ami-tools

# do some cleanup before rebundling
rm -f /arch/root/.*hist*
rm -f /arch/var/log/*.gz
{% endhighlight %}

Export security credentials
{% highlight bash %}
export AMAZON_USER_ID='XXXXXXXXXXX'
export AMAZON_ACCESS_KEY_ID='XXXXXXXXXXXXXX'
export AMAZON_SECRET_ACCESS_KEY='XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'

export RELEASE=`date '+%Y%m%d%H%M%S'`

# enter your s3 bucket here
export BUCKET="XXXXXXXXXXXXX"

export PREFIX="archlinux-x86_64-${RELEASE}"

export REGION="us-east-1"

cat >/mnt/pk.pem <<\EOF
-----BEGIN PRIVATE KEY-----
XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
XXXXXXXX
-----END PRIVATE KEY-----
EOF

cat >/mnt/cert.pem <<\EOF
-----BEGIN CERTIFICATE-----
XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
XXXXXXXX
-----END CERTIFICATE-----
EOF

export EC2_PRIVATE_KEY=/mnt/pk.pem
export EC2_CERT=/mnt/cert.pem
{% endhighlight %}

{% highlight bash %}
ec2-bundle-vol \
-v /arch \
-r x86_64 \
-d /mnt \
-p ${PREFIX} \
-u ${AMAZON_USER_ID} \
-k ${EC2_PRIVATE_KEY} \
-c ${EC2_CERT} \
-s 10000 \
-e /mnt,/root

ec2-upload-bundle \
-b ${BUCKET} \
-m /mnt/${PREFIX}.manifest.xml \
-a ${AMAZON_ACCESS_KEY_ID} \
-s ${AMAZON_SECRET_ACCESS_KEY}

ec2-register --region ${REGION} -K ${EC2_PRIVATE_KEY} -C ${EC2_CERT} ${BUCKET}/${PREFIX}.manifest.xml
{% endhighlight %}