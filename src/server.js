const WebSocket = require("ws");

const PORT = 8080;
const wss = new WebSocket.Server({ port: PORT });

let clients = [];

wss.on("connection", (ws) => {
	console.log("Новое соединение установлено");
	ws.name = null;
	ws.color = "#000000"; // Стандартный цвет
	clients.push(ws);

	ws.on("message", (message) => {
		try {
			const data = JSON.parse(message);

			if (data.type === "setName") {
				ws.name = data.name;
				ws.color = data.color || getRandomColor();
				handleUserJoin(ws);
			} else if (data.type === "message") {
				if (ws.name) {
					const fullMessage = {
						type: "broadcast",
						name: ws.name,
						color: ws.color,
						message: data.message,
					};
					broadcastMessage(fullMessage);
				} else {
					ws.send(
						JSON.stringify({
							type: "system",
							message: "Сначала представьтесь.",
						})
					);
				}
			} else if (data.type === "privateMessage") {
				handlePrivateMessage(ws, data);
			}
		} catch (error) {
			console.error("Ошибка обработки сообщения:", error);
		}
	});

	ws.on("close", () => {
		console.log("Соединение закрыто");
		clients = clients.filter((client) => client !== ws);
		if (ws.name) {
			const leaveMessage = {
				type: "system",
				message: `${ws.name} покинул чат.`,
			};
			broadcastMessage(leaveMessage);
			sendUserList();
		}
	});
});

function handleUserJoin(ws) {
	if (clients.length === 1) {
		ws.send(
			JSON.stringify({
				type: "system",
				message: "Добро пожаловать. Вы первый в чате.",
			})
		);
	} else {
		const names = clients
			.filter((client) => client.name && client !== ws)
			.map((client) => client.name)
			.join(", ");
		ws.send(
			JSON.stringify({
				type: "system",
				message: `Добро пожаловать. В чате уже присутствуют: ${names}.`,
			})
		);
		const joinMessage = {
			type: "system",
			message: `К нам присоединился ${ws.name}.`,
		};
		broadcastMessage(joinMessage, ws);
	}
	sendUserList();
}

function broadcastMessage(message, excludeWs = null) {
	clients.forEach((client) => {
		if (client.readyState === WebSocket.OPEN && client !== excludeWs) {
			client.send(JSON.stringify(message));
		}
	});
}

function sendUserList() {
	const userList = clients
		.filter((client) => client.name)
		.map((client) => ({ name: client.name, color: client.color }));
	const data = JSON.stringify({ type: "userList", users: userList });
	clients.forEach((client) => {
		if (client.readyState === WebSocket.OPEN) {
			client.send(data);
		}
	});
}

function handlePrivateMessage(senderWs, data) {
	const recipientName = data.to;
	const messageText = data.message;
	const recipientWs = clients.find((client) => client.name === recipientName);

	if (recipientWs && recipientWs.readyState === WebSocket.OPEN) {
		// Отправляем личное сообщение получателю
		const privateMessage = {
			type: "private",
			from: senderWs.name,
			message: messageText,
			color: senderWs.color,
		};
		recipientWs.send(JSON.stringify(privateMessage));

		// Подтверждение отправителю
		const confirmation = {
			type: "system",
			message: `Вы отправили личное сообщение ${recipientName}: ${messageText}`,
		};
		senderWs.send(JSON.stringify(confirmation));
	} else {
		// Если получатель не найден
		const errorMessage = {
			type: "system",
			message: `Пользователь ${recipientName} не найден.`,
		};
		senderWs.send(JSON.stringify(errorMessage));
	}
}

function getRandomColor() {
	const letters = "0123456789ABCDEF";
	let color = "#";
	for (let i = 0; i < 6; i++) {
		color += letters[Math.floor(Math.random() * 16)];
	}
	return color;
}

console.log(`Сервер запущен на ws://localhost:${PORT}`);
