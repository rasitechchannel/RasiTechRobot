const TelegramBot = require("node-telegram-bot-api");
const moment = require("moment");
const os = require("os");
const fs = require("fs");
const { exec, spawn } = require("child_process");
const axios = require("axios");
const sharp = require("sharp");
// const fetch = require('node-fetch');
const ping = require("ping");
const net = require("net");
const dgram = require("dgram");
const dns = require("dns-socket");
const whois = require("whois-json");
const path = require("path");
const gm = require("gm").subClass({ imageMagick: true });
const ffmpeg = require("fluent-ffmpeg");

const settings = JSON.parse(
  fs.readFileSync(path.join(__dirname, "settings/config.json"), "utf8")
);

// console.log(settings.ownerId)

// Ganti dengan token bot Telegram Anda
// const token = "6175150154:AAGiMJ72Q-9TnUEL8oOIzLdHPcbWvyHmTBU";
const token = settings.token;
// const apiKey = settings.apikey_zen;

// Inisialisasi bot
const bot = new TelegramBot(token, { polling: true });

// Function untuk mengirim pesan dengan membagi menjadi bagian-bagian yang lebih kecil jika terlalu panjang
function sendMessage(chatId, text, options) {
  const maxMessageLength = 4096; // Batas panjang pesan

  if (text.length <= maxMessageLength) {
    bot.sendMessage(chatId, text, options);
  } else {
    const messageParts = splitTextIntoParts(text, maxMessageLength);
    for (let i = 0; i < messageParts.length; i++) {
      bot.sendMessage(chatId, messageParts[i], options);
    }
  }
}

// Function untuk membagi teks menjadi bagian-bagian yang lebih kecil
function splitTextIntoParts(text, maxLength) {
  const parts = [];

  while (text.length > 0) {
    const part = text.substring(0, maxLength);
    parts.push(part);
    text = text.substring(maxLength);
  }

  return parts;

}


// Fungsi untuk mendownload video dari API
async function downloadYouTubeVideo(url) {
  const apiUrl = `https://api-miftah.xyz/api/downloader/youtube-video?url=${encodeURIComponent(url)}&key=${settings.apikey_miftah}`;

  try {
    const response = await axios.get(apiUrl);
    return response.data;
  } catch (error) {
    console.error('Error downloading YouTube video:', error);
    return null;
  }
}

// Fungsi untuk menyimpan video ke file lokal
async function saveVideoToLocal(url) {
  const videoResponse = await axios.get(url, { responseType: 'stream' });
  const videoFile = fs.createWriteStream('video.mp4');
  videoResponse.data.pipe(videoFile);

  return new Promise((resolve, reject) => {
    videoFile.on('finish', () => resolve());
    videoFile.on('error', (error) => reject(error));
  });
}

// Fungsi untuk mendapatkan gambar sambutan dari API
async function getWelcomeImage(name, groupName, memberCount, profilePhotoUrl, background) {
  const apiUrl = `https://api-miftah.xyz/api/canvas/welcome?name=${encodeURIComponent(name)}&groupname=${encodeURIComponent(groupName)}&member=${memberCount}&profilepicture=${profilePhotoUrl}&background=${background}&key=${settings.apikey_miftah}`;

  try {
    const response = await axios.get(apiUrl);
    return response.data.url;
  } catch (error) {
    console.error('Error fetching welcome image:', error);
    return null;
  }
}



// Handler untuk event "new_chat_members", yaitu saat ada anggota baru masuk grup
bot.on('new_chat_members', async (message) => {
  const chatId = message.chat.id;

  // Ambil informasi dari grup dan anggota baru yang masuk
  const groupName = message.chat.title;
  const memberCount = message.chat.members_count;
  const newUser = message.new_chat_member;
  const userName = newUser.username || newUser.first_name;

  // Ambil URL foto profil pengguna
  let profilePhotoUrl = '';
  if (newUser.id) {
    try {
      const userProfilePhotos = await bot.getUserProfilePhotos(newUser.id);
      if (userProfilePhotos.total_count > 0) {
        const photo = userProfilePhotos.photos[0][0];
        profilePhotoUrl = await bot.getFileLink(photo.file_id);
      }
    } catch (error) {
      console.error('Error getting user profile photo:', error);
    }
  }

  const background = settings.bgwelcome;

  // Ambil gambar sambutan dari API
  const welcomeImage = await getWelcomeImage(userName, groupName, memberCount, profilePhotoUrl, background);

  // Kirim pesan gambar sambutan
  if (welcomeImage) {
    bot.sendPhoto(chatId, welcomeImage, { caption: `Selamat datang di grup ${groupName}, @${userName}!` })
      .catch((error) => console.error('Error sending welcome image:', error));
  }
});

// Handler untuk event "left_chat_member", yaitu saat ada anggota keluar dari grup
bot.on('left_chat_member', (message) => {
  const chatId = message.chat.id;
  const userName = message.left_chat_member.username || message.left_chat_member.first_name;

  bot.sendMessage(chatId, `Sampai jumpa lagi, @${userName}! Semoga harimu menyenangkan.`)
    .catch((error) => console.error('Error sending goodbye message:', error));
});


// Mendengarkan event "message" dari pengguna
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const messageText = msg.text;
  const messageId = msg.message_id;
  if (!messageText) {
    console.log("No text message found.");
    return;
  }

  const command = messageText.split(" ")[0];
  const args = messageText.split(" ").slice(1);
  const query = args.join(" ");

  // Mengecek perintah yang dikirim oleh pengguna
  bot.forwardMessage(settings.log_chatid, chatId, messageId);
  const inlineKeyboard = {
    inline_keyboard: [
      [
        {
          text: "User ID",
          url: `tg://user?id=${chatId}`,
        },
      ],
    ],
  };

  sendMessage(
    settings.log_chatid,
    `User ID: <a href="tg://user?id=${chatId}">${chatId}</a>\nFrom ID: <a href="tg://user?id=${msg.from.id}">${msg.from.id}</a>\nFirst Name: <a href="tg://user?id=${chatId}">${msg.chat.first_name}</a>\nLast Name: <a href="tg://user?id=${chatId}">${msg.chat.last_name}</a>\nUsername: <a href="tg://user?id=${chatId}">${msg.chat.username}</a>\n`,
    { parse_mode: "HTML", reply_markup: JSON.stringify(inlineKeyboard) }
  );

  console.log(msg);
  // Memisahkan teks menjadi array
  switch (command) {
    case "/ytmp4":
  // Download video dari API
  const downloadResponse = await downloadYouTubeVideo(query);

  if (downloadResponse && downloadResponse.status === 'Success') {
    const data = downloadResponse.data;
    const responseMessage = `
Title: ${data.title}
Channel: ${data.channel}
Published: ${data.published}
Views: ${data.views}`;

    // Simpan video ke file lokal "video.mp4"
    await saveVideoToLocal(data.url);

    // Kirim video dari file lokal "video.mp4" ke pengguna
    bot.sendVideo(chatId, 'video.mp4', { caption: responseMessage })
      .then(() => {
        // Hapus file lokal setelah dikirim
        fs.unlinkSync('video.mp4');
      })
      .catch((error) => console.error('Error sending YouTube video:', error));
  } else {
    bot.sendMessage(chatId, 'Maaf, terjadi kesalahan saat mendownload video. Pastikan URL video YouTube valid dan coba lagi.')
      .catch((error) => console.error('Error sending error message:', error));
  }
    break
    case "/sticker":
      if (!msg.reply_to_message || !msg.reply_to_message.photo) {
        bot.sendMessage(
          chatId,
          "Please reply to a photo with /sticker command."
        );
        return;
      }

      try {
        const photoId =
          msg.reply_to_message.photo[msg.reply_to_message.photo.length - 1]
            .file_id;
        const photoFile = await bot.getFile(photoId);

        if (
          !photoFile.file_path.endsWith(".jpg") &&
          !photoFile.file_path.endsWith(".jpeg") &&
          !photoFile.file_path.endsWith(".png")
        ) {
          bot.sendMessage(
            chatId,
            "Unsupported image format. Only JPEG and PNG images are supported."
          );
          return;
        }

        const photoUrl = `https://api.telegram.org/file/bot${bot.token}/${photoFile.file_path}`;
        const response = await axios.get(photoUrl, {
          responseType: "arraybuffer",
        });

        if (!response.data || response.data.length === 0) {
          console.error("Error: Image buffer is empty.");
          bot.sendMessage(
            chatId,
            "Error processing the photo. Please try again later."
          );
          return;
        }

        // Save the image as "sticker.jpg"
        fs.writeFileSync("sticker.jpg", response.data);

        // Resize and convert to webp using sharp
        await sharp("sticker.jpg")
          .resize(512, 512)
          .toFile("sticker.webp", (err) => {
            if (err) {
              console.error("Error converting image to sticker:", err);
              bot.sendMessage(
                chatId,
                "Error converting image to sticker. Please try again later."
              );
              return;
            }

            // Read the .webp file and send it as a sticker
            const stickerData = fs.readFileSync("sticker.webp");
            bot
              .sendSticker(chatId, stickerData, {
                reply_to_message_id: messageId,
              })
              .then(() => {
                console.log("Sticker sent!");
                // Clean up: delete temporary files
                fs.unlinkSync("sticker.jpg");
                fs.unlinkSync("sticker.webp");
              })
              .catch((error) => {
                console.error("Error sending sticker:", error);
              });
          });
      } catch (error) {
        console.error("Error processing the photo:", error);
        bot.sendMessage(
          chatId,
          "Error processing the photo. Please try again later."
        );
      }
      break;
    case "/toimg":
      if (!msg.reply_to_message || !msg.reply_to_message.sticker) {
        bot.sendMessage(
          msg.chat.id,
          "Please reply to a sticker with /toimg command."
        );
        return;
      }

      try {
        const stickerId = msg.reply_to_message.sticker.file_id;
        const stickerFile = await bot.getFile(stickerId);
        const stickerUrl = `https://api.telegram.org/file/bot${bot.token}/${stickerFile.file_path}`;

        // Download the sticker image
        const response = await axios.get(stickerUrl, {
          responseType: "arraybuffer",
        });

        if (!response.data || response.data.length === 0) {
          console.error("Error: Sticker buffer is empty.");
          bot.sendMessage(
            msg.chat.id,
            "Error processing the sticker. Please try again later."
          );
          return;
        }

        // Convert webp to jpg using sharp directly to buffer
        const jpgBuffer = await sharp(response.data)
          .toFormat("jpeg")
          .toBuffer();

        // Send the jpg image as a photo
        bot.sendPhoto(msg.chat.id, jpgBuffer, {
          caption: "Here is the sticker as an image!",
        });
      } catch (error) {
        console.error("Error processing the sticker:", error);
        bot.sendMessage(
          msg.chat.id,
          "Error processing the sticker. Please try again later."
        );
      }
      break;
    case "/start":
      const currentTime = moment().format("YYYY-MM-DD HH:mm:ss");
      const name = msg.from.first_name || "";
      const username = msg.from.username || "";
      const userId = msg.from.id;
      const serverStatus = getServerStatus();
      const isPremium = checkPremium(userId);
      if (!isUserExists(userId)) {
        addUser(userId);
      }

      let welcomeMessage = `<b>Halo, ${name}!</b> Selamat datang di bot ini.`;

      if (isPremium) {
        welcomeMessage += "\n\nAnda adalah pengguna premium.";
      } else {
        welcomeMessage += "\n\nAnda bukan pengguna premium.";
      }

      welcomeMessage += `
        \nInformasi Pengguna:
- Nama: ${name}
- Username: ${username}
- ID: ${userId}

Informasi Server:
- Waktu saat ini: ${currentTime}
- Status Koneksi: ${serverStatus}


FITUR GENERAL
/start
/id
/help

FITUR DOWNLOAD
/ytmp4

FITUR STICKER
/sticker
/toimg

FITUR OWNER
/bc
/addprem
/exec

FITUR TOOLS
/translate

FITUR GAME
/tebaklagu
/tebakgambar
/dare
/truth
/tebakbendera
/caklontong
/asahotak
/siapaaku
/susunkata

FITUR INTERNET
/dns
/http
/whois
/ping
/udpport
/tcpport

FITUR PENCARIAN
/wiki
/chord
/sfile

FITUR RANDOM TEXT
/quotes
      `;

      sendMessage(chatId, welcomeMessage, { parse_mode: "HTML" });
      break;
    case "/help":
      sendMessage(
        chatId,
        "Jika ada pertanyaan atau bantuan, anda bisa berlangganan channel",
        {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "Channel Update",
                  url: "https://t.me/RasiTechChannel1",
                },
              ],
            ],
          },
        }
      );
      break;
    case "/id":
      sendMessage(chatId, "ID Anda : `" + msg.from.id + "`", {
        parse_mode: "markdownv2",
      });
      break;
    case "/quotes":
      const quotes = await axios.get(
        "https://api.zahwazein.xyz/randomtext/randomquote?apikey=" +
          settings.apikey_zen
      );
      sendMessage(chatId, quotes.data.result.message);
      break;
    case "/addprem":
      if (isBotOwner(msg.from.id)) {
        const targetUserId = args[0];
        addPremiumUser(targetUserId);
        sendMessage(
          chatId,
          `Pengguna dengan ID ${targetUserId} telah ditambahkan ke daftar premium.`
        );
      } else {
        sendMessage(
          chatId,
          "Anda tidak memiliki izin untuk menggunakan perintah ini."
        );
      }
      break;
    case "/exec":
      if (isBotOwner(msg.from.id)) {
        const commandToExecute = args.join(" ");
        executeCommand(commandToExecute, chatId);
      } else {
        sendMessage(
          chatId,
          "Anda tidak memiliki izin untuk menggunakan perintah ini."
        );
      }
      break;
    case "/wiki":
      if (!query)
        return sendMessage(
          chatId,
          "Masukan kata kunci pencarian!\n\n/wiki plankton"
        );
      getWikipediaInfo(query, chatId);
      break;
    case "/dns":
      if (!query)
        return sendMessage(chatId, "Masukan Domain!\n\n/dns google.com");

      const socketd = dns();

      socketd.query(
        { questions: [{ type: "A", name: query }] },
        53,
        "8.8.8.8",
        (err, res) => {
          if (err) {
            sendMessage(chatId, `Error: ${err.message}`);
            return;
          }

          if (res.answers.length === 0) {
            sendMessage(chatId, `No DNS records found for ${domain}`);
            return;
          }

          const ipAddress = res.answers[0].data;
          sendMessage(chatId, `IP Address for ${query}: ${ipAddress}`);
        }
      );
      break;
    case "/whois":
      if (!query)
        return sendMessage(chatId, "Masukan Domain!\n\n/whois google.com");
      const domain = query;

      try {
        const result = await whois(domain);
        let responseMsg = `WHOIS data for ${domain}:\n\n`;
        for (const key in result) {
          responseMsg += `${key}: ${result[key]}\n`;
        }
        sendMessage(chatId, responseMsg);
      } catch (error) {
        sendMessage(chatId, `Error: ${error.message}`);
      }
      break;
    case "/tcpport":
      if (!query)
        return sendMessage(
          chatId,
          "Masukan HOST & PORT!\n\n/tcpport 8.8.8.8 80"
        );

      // Assuming `query` contains the user input

      const port = parseInt(query.split(" ")[1]);

      if (isNaN(port) || port < 1 || port > 65535) {
        sendMessage(
          chatId,
          "Invalid port number. Port should be > 0 and < 65536."
        );
        return;
      }

      const sockett = new net.Socket();

      sockett.setTimeout(2000); // Timeout 2 detik untuk koneksi

      sockett.on("connect", () => {
        sendMessage(
          chatId,
          `Port ${parseInt(query.split(" ")[1])} on ${
            query.split(" ")[0]
          } is OPEN`
        );
        sockett.end();
      });

      sockett.on("timeout", () => {
        sendMessage(
          chatId,
          `Port ${parseInt(query.split(" ")[1])} on ${
            query.split(" ")[0]
          } is TIMEOUT`
        );
        sockett.destroy();
      });

      sockett.on("error", (err) => {
        sendMessage(
          chatId,
          `Port ${parseInt(query.split(" ")[1])} on ${
            query.split(" ")[0]
          } is CLOSED`
        );
      });

      sockett.connect(parseInt(query.split(" ")[1]), query.split(" ")[0]);
      break;
    case "/udpport":
      if (!query)
        return sendMessage(
          chatId,
          "Masukan HOST & PORT!\n\n/udpport 8.8.8.8 80"
        );
      const targetHost = query.split(" ")[0];
      const targetPort = parseInt(query.split(" ")[1]);

      if (isNaN(targetPort) || targetPort < 1 || targetPort > 65535) {
        sendMessage(
          chatId,
          "Invalid port number. Port should be > 0 and < 65536."
        );
        return;
      }

      const socket = dgram.createSocket("udp4");

      socket.on("message", (message) => {
        sendMessage(chatId, `Received message: ${message}`);
        socket.close();
      });

      socket.on("error", (err) => {
        sendMessage(chatId, `Error: ${err.message}`);
      });

      const message = Buffer.from("Test message");

      socket.send(message, 0, message.length, targetPort, targetHost, (err) => {
        if (err) {
          sendMessage(chatId, `Port ${targetPort} on ${targetHost} is CLOSED`);
        } else {
          sendMessage(chatId, `Port ${targetPort} on ${targetHost} is OPEN`);
        }
        socket.close();
      });
      break;
    case "/ping":
      if (!query)
        return sendMessage(chatId, "Masukan Domain!\n\n/ping google.com");

      try {
        const res = await ping.promise.probe(query);
        const rttMsg = res.alive
          ? `\nRTT min: ${res.min}ms, avg: ${res.avg}ms, max: ${res.max}ms`
          : "";
        sendMessage(chatId, `Status: ${res.alive ? "UP" : "DOWN"}${rttMsg}`);
      } catch (error) {
        sendMessage(chatId, `Error: ${error.message}`);
      }

      break;
    case "/http":
      //     if (!query) return sendMessage(chatId, "Masukan URL!\n\n/http https://google.com")

      // try {
      //   const response = await fetch(query);
      //   const responseCode = response.status;
      //   const responseTime = response.headers.get('X-Response-Time');

      //   let resultMsg = `Status: ${responseCode}\n`;
      //   if (responseTime) {
      //     resultMsg += `Response Time: ${responseTime}\n`;
      //   }

      //   sendMessage(chatId, resultMsg);
      // } catch (error) {
      //   sendMessage(chatId, `Error: ${error.message}`);
      // }

      break;
    case "/tebaklagu":
      try {
        const response = await axios.get(
          "https://api.zahwazein.xyz/entertainment/tebaklagu2?apikey=" +
            settings.apikey_zen
        );
        const data = response.data.result;
        const audioLink = data.link_song;
        const artist = data.artist[0];
        const answer = data.jawaban;

        const caption = `Apa nama judul lagu ini?`;

        const inlineKeyboard = {
          inline_keyboard: [
            [
              {
                text: "Lihat Jawaban",
                callback_data: `${artist}|${answer}`,
              },
            ],
          ],
        };

        const audioOptions = {
          caption,
          reply_markup: JSON.stringify(inlineKeyboard),
        };

        bot.sendAudio(msg.chat.id, audioLink, audioOptions);
      } catch (error) {
        console.error(error);
        bot.sendMessage(
          msg.chat.id,
          "Terjadi kesalahan saat mengambil data tebak lagu."
        );
      }
      break;
    case "/tebakbendera":
      try {
        const response = await axios.get(
          "https://api.zahwazein.xyz/entertainment/tebakbendera?apikey=" +
            settings.apikey_zen
        );
        const data = response.data.result;
        // const soalIndex = data.index;
        const img = data.img;
        const flag = data.flag;
        const name = data.name;

        const caption = `Tebak Bendera`;

        const inlineKeyboard = {
          inline_keyboard: [
            [
              {
                text: "Lihat Jawaban",
                callback_data: `${flag}|${name}`,
              },
            ],
          ],
        };

        const photoOptions = {
          caption,
          reply_markup: JSON.stringify(inlineKeyboard),
        };

        bot.sendPhoto(msg.chat.id, img, photoOptions);
      } catch (error) {
        console.error(error);
        bot.sendMessage(
          msg.chat.id,
          "Terjadi kesalahan saat mengambil data tebak bendera."
        );
      }
      break;
    case "/tebakgambar":
      try {
        const response = await axios.get(
          "https://api.zahwazein.xyz/entertainment/tebakgambar?apikey=" +
            settings.apikey_zen
        );
        const data = response.data.result;
        const soalIndex = data.index;
        const img = data.img;
        const jawaban = data.jawaban;
        const deskripsi = data.deskripsi;

        const caption = `Tebak Gambar`;

        const inlineKeyboard = {
          inline_keyboard: [
            [
              {
                text: "Lihat Jawaban",
                callback_data: `${jawaban}|${deskripsi}|${soalIndex}`,
              },
            ],
          ],
        };

        const photoOptions = {
          caption,
          reply_markup: JSON.stringify(inlineKeyboard),
        };

        bot.sendPhoto(msg.chat.id, img, photoOptions);
      } catch (error) {
        console.error(error);
        bot.sendMessage(
          msg.chat.id,
          "Terjadi kesalahan saat mengambil data tebak gambar."
        );
      }
      break;
    case "/asahotak":
      try {
        const response = await axios.get(
          "https://api.zahwazein.xyz/entertainment/asahotak?apikey=" +
            settings.apikey_zen
        );
        const data = response.data.result;
        const soal = data.soal;
        const jawaban = data.jawaban;

        // const caption = `Tebak Gambar`;

        const inlineKeyboard = {
          inline_keyboard: [
            [
              {
                text: "Lihat Jawaban",
                callback_data: `Asahotak|${jawaban}`,
              },
            ],
          ],
        };

        bot.sendMessage(msg.chat.id, `Kuis Asah Otak\n\nSoal: ${soal}`, {
          reply_markup: JSON.stringify(inlineKeyboard),
        });
      } catch (error) {
        console.error(error);
        bot.sendMessage(
          msg.chat.id,
          "Terjadi kesalahan saat mengambil data kuis asah otak."
        );
      }
      break;
    case "/susunkata":
      try {
        const response = await axios.get(
          "https://api.zahwazein.xyz/entertainment/susunkata?apikey=" +
            settings.apikey_zen
        );
        const data = response.data.result;
        const soal = data.soal;
        const jawaban = data.jawaban;
        const tipe = data.tipe;

        // const caption = `Tebak Gambar`;

        const inlineKeyboard = {
          inline_keyboard: [
            [
              {
                text: "Lihat Jawaban",
                callback_data: `SusunKata|${jawaban}`,
              },
            ],
          ],
        };

        bot.sendMessage(
          msg.chat.id,
          `Kuis Susun Kata\n\nSoal: ${soal}\nTipe: ${tipe}`,
          { reply_markup: JSON.stringify(inlineKeyboard) }
        );
      } catch (error) {
        console.error(error);
        bot.sendMessage(
          msg.chat.id,
          "Terjadi kesalahan saat mengambil data kuis susun kata."
        );
      }
      break;
    case "/dare":
      try {
        const response = await axios.get(
          "https://api.zahwazein.xyz/entertainment/dare?apikey=" +
            settings.apikey_zen
        );
        const data = response.data.result;
        // const soal = data.soal;
        // const jawaban = data.jawaban;

        // const caption = `Tebak Gambar`;

        // const inlineKeyboard = {
        //   inline_keyboard: [
        //     [
        //       {
        //         text: 'Lihat Jawaban',
        //         callback_data: `Asahotak|${jawaban}`,
        //       },
        //     ],
        //   ],
        // };

        bot.sendMessage(msg.chat.id, `Dare: ${data}`);
      } catch (error) {
        console.error(error);
        bot.sendMessage(
          msg.chat.id,
          "Terjadi kesalahan saat mengambil data Dare."
        );
      }
      break;
    case "/truth":
      try {
        const response = await axios.get(
          "https://api.zahwazein.xyz/entertainment/truth?apikey=" +
            settings.apikey_zen
        );
        const data = response.data.result;
        // const soal = data.soal;
        // const jawaban = data.jawaban;

        // const caption = `Tebak Gambar`;

        // const inlineKeyboard = {
        //   inline_keyboard: [
        //     [
        //       {
        //         text: 'Lihat Jawaban',
        //         callback_data: `Asahotak|${jawaban}`,
        //       },
        //     ],
        //   ],
        // };

        bot.sendMessage(msg.chat.id, `Truth: ${data}`);
      } catch (error) {
        console.error(error);
        bot.sendMessage(
          msg.chat.id,
          "Terjadi kesalahan saat mengambil data Truth."
        );
      }
      break;
    case "/siapaaku":
      try {
        const response = await axios.get(
          "https://api.zahwazein.xyz/entertainment/siapakah?apikey=" +
            settings.apikey_zen
        );
        const data = response.data.result;
        const soal = data.soal;
        const jawaban = data.jawaban;

        // const caption = `Tebak Gambar`;

        const inlineKeyboard = {
          inline_keyboard: [
            [
              {
                text: "Lihat Jawaban",
                callback_data: `SiapaAku|${jawaban}`,
              },
            ],
          ],
        };

        bot.sendMessage(msg.chat.id, `Kuis Siapakah Aku\n\nSoal: ${soal}`, {
          reply_markup: JSON.stringify(inlineKeyboard),
        });
      } catch (error) {
        console.error(error);
        bot.sendMessage(
          msg.chat.id,
          "Terjadi kesalahan saat mengambil data kuis siapakah aku."
        );
      }
      break;
    case "/caklontong":
      try {
        const response = await axios.get(
          "https://api.zahwazein.xyz/entertainment/caklontong?apikey=" +
            settings.apikey_zen
        );
        const data = response.data.result;
        const soal = data.soal;
        const jawaban = data.jawaban;
        const deskripsi = data.deskripsi;

        // const caption = `Tebak Gambar`;

        const inlineKeyboard = {
          inline_keyboard: [
            [
              {
                text: "Lihat Jawaban",
                callback_data: `CakLontong|${jawaban}|${deskripsi}`,
              },
            ],
          ],
        };

        bot.sendMessage(msg.chat.id, `Kuis Cak Lontong\n\nSoal: ${soal}`, {
          reply_markup: JSON.stringify(inlineKeyboard),
        });
      } catch (error) {
        console.error(error);
        bot.sendMessage(
          msg.chat.id,
          "Terjadi kesalahan saat mengambil data kuis cak lontong."
        );
      }
      break;
    case "/gbard":
      if (!query)
        return bot.sendMessage(
          chatId,
          "Masukan kata kunci pencarian!\n\n/gbard apa itu ikan"
        );
      getBardInfo(query, chatId);
      break;
    case "/translate":
      if (!query)
        return bot.sendMessage(
          chatId,
          "Masukan kata kunci terjemah!\n\n/translate how are you"
        );
      try {
        // Mengirim permintaan ke API terjemahan
        const response = await axios.get(
          `https://api.zahwazein.xyz/information/translate/id?query=${encodeURIComponent(
            query
          )}&apikey=` + settings.apikey_zen
        );

        if (response.data.status === "OK") {
          const result = response.data.result;

          // Mengirim balasan ke pengguna
          bot.sendMessage(msg.chat.id, result);
        } else {
          // Menangani jika tidak ada hasil terjemahan
          bot.sendMessage(msg.chat.id, "Tidak ada hasil terjemahan.");
        }
      } catch (error) {
        console.error(error);
        bot.sendMessage(
          msg.chat.id,
          "Terjadi kesalahan saat memproses permintaan."
        );
      }
      break;
    case "/kbbi":
      if (!query)
        return bot.sendMessage(
          chatId,
          "Masukan kata kunci pencarian!\n\n/kbbi rumah"
        );
      try {
        // Mengirim permintaan ke API KBBI
        const response = await axios.get(
          `https://api.zahwazein.xyz/information/kbbi?query=${query}&apikey=` +
            settings.apikey_zen
        );

        if (response.data.status === "OK") {
          const result = response.data.result;
          const message = `<b>${result.title}</b>\n\n${result.arti}`;

          // Mengirim balasan ke pengguna
          bot.sendMessage(msg.chat.id, message, { parse_mode: "HTML" });
        } else {
          // Menangani jika tidak ada hasil dari KBBI
          bot.sendMessage(msg.chat.id, "Tidak ada hasil yang ditemukan.");
        }
      } catch (error) {
        console.error(error);
        bot.sendMessage(
          msg.chat.id,
          "Terjadi kesalahan saat memproses permintaan."
        );
      }
      break;
    case "/play":
      if (!query)
        return bot.sendMessage(
          chatId,
          "Masukan kata kunci pencarian!\n\n/play lathi"
        );
      bot.sendMessage(chatId, "Sedang mencari musik...");

      // Panggil API untuk mencari musik
      axios
        .get(
          "https://api.zahwazein.xyz/downloader/ytplay?apikey=" +
            settings.apikey_zen +
            "&query=" +
            encodeURIComponent(query)
        )
        .then((response) => {
          const result = response.data.result;

          // Jika status OK dan audio tersedia
          if (response.data.status === "OK" && result.getAudio.audioAvailable) {
            const audioUrl = result.getAudio.url;
            const audioSize = result.getAudio.formattedSize;
            const thumbnailUrl = result.thumbnail;
            const duration = result.duration;
            const title = result.title;
            const videoUrl = result.url;
            const quality = result.getAudio.quality;
            const extension = result.getAudio.extension;
            const formattedSize = result.getAudio.formattedSize;

            const message =
              `Durasi: ${duration}\n` +
              `Judul: ${title}\n` +
              `URL: ${videoUrl}\n` +
              `Kualitas: ${quality}\n` +
              `Ekstensi: ${extension}\n` +
              `Ukuran: ${formattedSize}`;

            // Simpan file audio dengan nama "audio.m4a"
            const filePath = "audio.m4a";
            const writer = fs.createWriteStream(filePath);

            axios({
              url: audioUrl,
              method: "GET",
              responseType: "stream",
            }).then((response) => {
              response.data.pipe(writer);

              writer.on("finish", () => {
                // Kirim file audio beserta thumbnail dan informasi lainnya ke pengguna
                const audioStream = fs.createReadStream(filePath);
                bot
                  .sendAudio(chatId, audioStream, {
                    caption: message,
                    thumb: thumbnailUrl,
                  })
                  .then(() => {
                    bot
                      .sendMessage(chatId, `File audio ditemukan: ${audioSize}`)
                      .catch((error) => {
                        console.log("Error sending message:", error);
                      });
                  })
                  .catch((error) => {
                    console.log("Error sending audio:", error);
                  });
              });

              writer.on("error", (error) => {
                console.log("Error saving audio:", error);
                bot.sendMessage(
                  chatId,
                  "Terjadi kesalahan saat menyimpan file audio."
                );
              });
            });
          } else {
            bot.sendMessage(
              chatId,
              "Maaf, tidak ada audio yang ditemukan untuk query tersebut."
            );
          }
        })
        .catch((error) => {
          console.log("Error searching music:", error);
          bot.sendMessage(chatId, "Terjadi kesalahan saat mencari musik.");
        });

      break;
    case "/chord":
      if (!query)
        return bot.sendMessage(
          chatId,
          "Masukan kata kunci pencarian!\n\n/chord asal kau bahagia"
        );
      getChordInfo(query, chatId);
      break;
    case "/sfile":
      if (!query)
        return bot.sendMessage(
          chatId,
          "Masukan kata kunci pencarian!\n\n/sfile youtube"
        );
      // Membuat URL API pencarian file dengan query yang diberikan
      const apiUrl = `https://api.zahwazein.xyz/searching/sfilesearch?apikey=${settings.apikey_zen}&query=${query}`;

      // Mengambil data dari API
      axios
        .get(apiUrl)
        .then((response) => {
          const data = response.data;

          // Memeriksa status respons API
          if (data.status === "OK") {
            const results = data.result;

            // Memilih hasil acak dari array hasil
            const randomResult =
              results[Math.floor(Math.random() * results.length)];

            // Memeriksa apakah hasil memiliki ikon, nama, dan tautan
            if (randomResult.icon && randomResult.name && randomResult.link) {
              // Mengirim stiker dan tombol tautan inline
              sendStickerWithInlineButton(
                chatId,
                randomResult.icon,
                randomResult.name,
                randomResult.link
              );
            } else {
              bot.sendMessage(chatId, "Tidak ada hasil yang valid ditemukan.");
            }
          } else {
            bot.sendMessage(chatId, "Terjadi kesalahan dalam mencari file.");
          }
        })
        .catch((error) => {
          console.log("Error:", error);
          bot.sendMessage(chatId, "Terjadi kesalahan dalam mencari file.");
        });
      break;
    case "/bc":
      if (isBotOwner(msg.from.id)) {
        const broadcastMessage = args.join(" ");
        sendBroadcastMessage(broadcastMessage);
      } else {
        bot.sendMessage(
          chatId,
          "Anda tidak memiliki izin untuk menggunakan perintah ini."
        );
      }
      break;
    default:
      sendMessage(chatId, "Perintah tidak dikenali. Silakan coba lagi.");
      break;
  }
});

bot.on("callback_query", (query) => {
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;
  const data = query.data;
  console.log(query);
  const buttons = [
    [
      { text: "Naik ⬆️", callback_data: "transpose_up" },
      { text: "Turun ⬇️", callback_data: "transpose_down" },
    ],
  ];

  const inlineKeyboard = {
    inline_keyboard: buttons,
  };

  // Pastikan Anda mengganti `sendMessage` dengan `bot.sendMessage` jika menggunakan library "node-telegram-bot-api".

  // Dapatkan tipe kuis dari query.data.split('|')[0]
  const dataParts = data.split("|"); // Pecah string query.data menjadi array

  if (dataParts[0] === "SusunKata") {
    const replyOptions = {
      reply_to_message_id: messageId, // Menyertakan ID pesan yang akan di-reply
    };
    bot.sendMessage(
      chatId,
      `Jawaban Kuis Susun Kata: ${dataParts[1]}`,
      replyOptions
    );
  } else if (dataParts[0] === "AsahOtak") {
    const replyOptions = {
      reply_to_message_id: messageId, // Menyertakan ID pesan yang akan di-reply
    };
    bot.sendMessage(
      chatId,
      `Jawaban Kuis Asah Otak: ${dataParts[1]}`,
      replyOptions
    );
  } else if (dataParts[0] === "SiapaAku") {
    const replyOptions = {
      reply_to_message_id: messageId, // Menyertakan ID pesan yang akan di-reply
    };
    bot.sendMessage(
      chatId,
      `Jawaban Kuis Siapakah Aku: ${dataParts[1]}`,
      replyOptions
    );
  } else if (dataParts[0] === "CakLontong") {
    const replyOptions = {
      reply_to_message_id: messageId, // Menyertakan ID pesan yang akan di-reply
    };
    bot.sendMessage(
      chatId,
      `Jawaban Kuis Cak Lontong: ${dataParts[1]}\n\nPenjelasan: ${dataParts[2]}`,
      replyOptions
    );
  }

  if (query.message.caption === "Tebak Gambar") {
    const data = query.data.split("|");
    const answerMessage = `Jawaban tebak gambar adalah:\n\nJawaban: <b>${data[0]}</b>\nDeskripsi: <b>${data[1]}</b>\nSoal Index: <b>${data[2]}</b>`;
    bot.sendMessage(query.message.chat.id, answerMessage, {
      parse_mode: "HTML",
      reply_to_message_id: messageId,
    });
  }
  if (query.message.caption === "Tebak Bendera") {
    const data = query.data.split("|");
    const answerMessage = `Jawaban tebak bendera adalah:\n\nJawaban: <b>${data[1]}</b>\nKode: <b>${data[0]}</b>`;
    bot.sendMessage(query.message.chat.id, answerMessage, {
      parse_mode: "HTML",
      reply_to_message_id: messageId,
    });
  }
  if (query.message.caption === "Apa nama judul lagu ini?") {
    const data = query.data.split("|");
    const answerMessage = `Jawaban tebak lagu adalah:\n\nArtist: <b>${data[0]}</b>\nLagu: <b>${data[1]}</b>`;
    bot.sendMessage(query.message.chat.id, answerMessage, {
      parse_mode: "HTML",
      reply_to_message_id: messageId,
    });
  }

  // Check the callback data and perform corresponding actions
  if (data === "transpose_up") {
    // Transpose chords up
    const transposedText = transposeTab(query.message.text, 1);
    bot.editMessageText(`*${transposedText}*`, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: "Markdown",
      reply_markup: JSON.stringify(inlineKeyboard),
    });
  } else if (data === "transpose_down") {
    // Transpose chords down
    const transposedText = transposeTab(query.message.text, -1);
    bot.editMessageText(`*${transposedText}*`, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: "Markdown",
      reply_markup: JSON.stringify(inlineKeyboard),
    });
  }
});

// Fungsi untuk mengirim stiker dan tombol tautan inline
async function sendStickerWithInlineButton(chatId, icon, name, link) {
  try {
    // Mengambil stiker dari URL icon
    const response = await axios.get(icon, { responseType: "arraybuffer" });

    // Konversi ke format stiker yang didukung (WEBP)
    const convertedStickerBuffer = await sharp(response.data)
      .toFormat("webp")
      .toBuffer();

    // Mengirim stiker
    await bot.sendSticker(chatId, convertedStickerBuffer);

    // Mengirim pesan teks dengan tombol tautan inline
    await bot.sendMessage(chatId, `${name}\n\n${link}`, {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "Download",
              url: link,
            },
          ],
        ],
      },
    });
  } catch (error) {
    console.log("Error sending sticker:", error);
  }
}

// Mendapatkan informasi dari Wikipedia menggunakan API
function getWikipediaInfo(query, chatId) {
  const apiUrl = `https://api.zahwazein.xyz/information/wikipedia?query=${encodeURIComponent(
    query
  )}&apikey=${settings.apikey_zen}`;

  axios
    .get(apiUrl)
    .then((response) => {
      const result = response.data.result;

      if (result) {
        const message = `
            *${result.judul}*
            
            ${result.isi}
          `;

        sendMessage(chatId, message, { parse_mode: "Markdown" });
      } else {
        sendMessage(chatId, "Tidak ada informasi yang ditemukan.");
      }
    })
    .catch((error) => {
      console.error(error);
      sendMessage(
        chatId,
        "Terjadi kesalahan saat mengambil informasi dari Wikipedia."
      );
    });
}

// Mendapatkan informasi dari Wikipedia menggunakan API
function getBardInfo(query, chatId) {
  const apiUrl = `https://api.akuari.my.id/ai/gbard?chat=${encodeURIComponent(
    query
  )}`;

  axios
    .get(apiUrl)
    .then((response) => {
      const result = response.data;

      if (result) {
        sendMessage(chatId, result.respon);
      } else {
        sendMessage(chatId, "Tidak ada informasi yang ditemukan.");
      }
    })
    .catch((error) => {
      console.error(error);
      sendMessage(
        chatId,
        "Terjadi kesalahan saat mengambil informasi dari Wikipedia."
      );
    });
}

// Mendapatkan status koneksi ke server
function getServerStatus() {
  const networkInterfaces = os.networkInterfaces();
  const hasInternetConnection =
    networkInterfaces["en0"]?.some(
      (iface) => iface.family === "IPv4" && !iface.internal
    ) ||
    networkInterfaces["eth0"]?.some(
      (iface) => iface.family === "IPv4" && !iface.internal
    );

  return hasInternetConnection ? "Terhubung" : "Tidak Terhubung";
}

// Memeriksa apakah pengguna adalah pemilik bot
function isBotOwner(userId) {
  // Ganti dengan ID pengguna Anda sebagai pemilik bot
  const ownerUserId = settings.ownerId;
  return userId.toString() === ownerUserId;
}

// Memeriksa apakah pengguna adalah pengguna premium
function checkPremium(userId) {
  const premiumData = getPremiumData();
  return premiumData.includes(userId);
}

// Menambahkan pengguna ke daftar premium
function addPremiumUser(userId) {
  const premiumData = getPremiumData();
  premiumData.push(userId);
  savePremiumData(premiumData);
}

// Mendapatkan data premium dari file premium.json
function getPremiumData() {
  const data = fs.readFileSync("premium.json", "utf8");
  return JSON.parse(data);
}

// Menyimpan data premium ke file premium.json
function savePremiumData(data) {
  fs.writeFileSync("premium.json", JSON.stringify(data));
}

// Menjalankan perintah terminal
function executeCommand(command, chatId) {
  exec(command, (error, stdout, stderr) => {
    if (error) {
      sendMessage(chatId, `Terjadi kesalahan:\n${error.message}`);
      return;
    }

    if (stderr) {
      sendMessage(chatId, `Output error:\n${stderr}`);
      return;
    }

    const output = stdout.toString();

    sendMessage(chatId, `Output:\n${output}`);
  });
}

// Mengecek apakah ID pengguna sudah ada dalam file user.json
function isUserExists(userId) {
  const users = getUsers();
  return users.includes(userId);
}

// Menambahkan ID pengguna ke dalam file user.json
function addUser(userId) {
  const users = getUsers();
  users.push(userId);
  saveUsers(users);
}

// Mendapatkan daftar ID pengguna dari file user.json
function getUsers() {
  try {
    const data = fs.readFileSync("users.json", "utf8");
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
}

// Menyimpan daftar ID pengguna ke dalam file user.json
function saveUsers(users) {
  fs.writeFileSync("users.json", JSON.stringify(users));
}

// Mengirim pesan broadcast ke seluruh ID pengguna dalam file users.json dengan delay 3 detik
function sendBroadcastMessage(message) {
  const users = getUsers();
  users.forEach((userId, index) => {
    setTimeout(() => {
      sendMessage(userId, message);
    }, index * 3000); // Delay 3 detik (3000 ms) antara pengiriman pesan
  });
}

var noteIds = {
  A: 0,
  "A#": 1,
  Bb: 1,
  B: 2,
  C: 3,
  "C#": 4,
  Db: 4,
  D: 5,
  "D#": 6,
  Eb: 6,
  E: 7,
  F: 8,
  "F#": 9,
  Gb: 9,
  G: 10,
  "G#": 11,
  Ab: 11,
};

var noteNames = [
  "A",
  "A#",
  "B",
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
];

var chordRegex = /\b[A-Ga-g][#b]?(sus|m|maj)?[2-9]?(\/[A-G][#b]?)?(?=\s|$)/g;
var noteRegex = /\b[A-G][#b]?/g;

function isChords(line) {
  var chordText = (line.match(chordRegex) || []).join("");
  var chords = chordText.length;
  var notChordText = line.replace(chordRegex, "").replace(/\s/g, "");
  var notChords = notChordText.length;
  return chords > notChords;
}

function transpose(chord, distance) {
  return chord.replace(noteRegex, function (note) {
    const noteId = noteIds[note.toUpperCase()];
    if (typeof noteId !== "undefined") {
      return noteNames[(noteId + distance + 12) % 12];
    } else {
      // Jika kunci nada tidak terdefinisi, kembalikan kunci nada yang sama
      return note;
    }
  });
}

function transposeTab(text, distance) {
  return text
    .split("\n")
    .map(function (line) {
      return isChords(line)
        ? line.replace(chordRegex, function (chord) {
            return transpose(chord, distance);
          })
        : line;
    })
    .join("\n");
}

function getChordInfo(query, chatId) {
  const apiUrl = `https://api.zahwazein.xyz/searching/chordlagu?query=${encodeURIComponent(
    query
  )}&apikey=${settings.apikey_zen}`;

  axios
    .get(apiUrl)
    .then((response) => {
      const result = response.data.result;

      if (result) {
        const message = `
            *${result.chord}*
          `;

        const buttons = [
          [
            { text: "Naik ⬆️", callback_data: "transpose_up" },
            { text: "Turun ⬇️", callback_data: "transpose_down" },
          ],
        ];

        const inlineKeyboard = {
          inline_keyboard: buttons,
        };

        const options = {
          parse_mode: "Markdown",
          reply_markup: JSON.stringify(inlineKeyboard),
        };

        bot.sendMessage(chatId, message, options);
      } else {
        bot.sendMessage(chatId, "Tidak ada informasi yang ditemukan.");
      }
    })
    .catch((error) => {
      console.error(error);
      bot.sendMessage(
        chatId,
        "Terjadi kesalahan saat mengambil informasi chord."
      );
    });
}
