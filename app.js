const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());

const http = require("http").createServer(app);

const PORT = process.env.PORT || 3001;
http.listen(PORT, () => {
  console.log("port", PORT);
});

const io = require("socket.io")(http, { cors: { origin: "*" } });

let dataBoards = [];
let numberShown = null;
let numbersShown = [];
let gameStarted = false;

io.on("connection", (socket) => {
  validationGameStarted(socket);

  socket.on("connection-game", (name) => {
    onConnectionGame(socket, name);
  });

  socket.on("generate-new-board", () => {
    onGenerateNewBoard(socket);
  });

  socket.on("play", () => {
    onPlay(socket);
  });

  socket.on("dial-current-number-shown", () => {
    onDialCurrentNumberShown(socket);
  });

  socket.on("next-number", () => {
    onNextNumber(socket);
  });

  socket.on("bingo", () => {
    onBingo(socket);
  });

  socket.on("disconnect", () => {
    onDisconnect(socket);
  });
});

const validationGameStarted = (socket) => {
  if (gameStarted) io.to(socket.id).emit("wait");
};

const updatePlayers = () => {
  io.emit(
    "update-players",
    dataBoards.map((dataBoard) => {
      return {
        name: dataBoard.name,
        playGame: dataBoard.playGame,
        nextNumber: dataBoard.nextNumber,
        winner: dataBoard.winner,
      };
    })
  );
};

const onConnectionGame = (socket, name) => {
  if (!gameStarted) {
    const board = newBoard(socket);

    dataBoards.push({
      clientId: socket.id,
      name,
      board,
      markedCells: [],
      playGame: false,
      nextNumber: false,
      winner: false,
    });

    updatePlayers();
  } else validationGameStarted(socket);
};

const generateBoard = () => {
  let min_number = 1;
  let max_number = 15;
  const NUM_CELLS = 25;
  const NUM_COLUMNS = 5;

  let board = "";

  let numbers = [];
  for (let i = 0; numbers.length < NUM_CELLS; ) {
    if (i !== 0 && i % 5 === 0) {
      min_number += 15;
      max_number += 15;
    }
    let number =
      Math.floor(Math.random() * (max_number - min_number + 1)) + min_number;
    if (numbers.indexOf(number) === -1) {
      numbers.push(number);
      i++;
    }
  }

  for (let i = 0; i < NUM_COLUMNS; i++) {
    for (let j = 0; j < NUM_COLUMNS; j++) {
      let indice = i + j * NUM_COLUMNS;
      if (i === 2 && j === 2) {
        board += "0-";
      } else {
        board +=
          i === NUM_COLUMNS - 1 && j === NUM_COLUMNS - 1
            ? numbers[indice]
            : numbers[indice] + "-";
      }
    }
  }

  return board;
};

const newBoard = (socket) => {
  const board = generateBoard();

  io.to(socket.id).emit("new-board", board);

  return board;
};

const onGenerateNewBoard = (socket) => {
  const board = newBoard(socket);

  dataBoards = dataBoards.map((dataBoard) => {
    if (dataBoard.clientId === socket.id) {
      dataBoard.board = board;
      return dataBoard;
    } else return dataBoard;
  });
};

const generateNumberShown = () => {
  let MIN_NUMBER = 1;
  let MAX_NUMBER = 75;

  let number = null;
  while (true) {
    number =
      Math.floor(Math.random() * (MAX_NUMBER - MIN_NUMBER + 1)) + MIN_NUMBER;
    if (numbersShown.indexOf(number) === -1) {
      numbersShown.push(number);
      break;
    }
  }

  numberShown = number;
  io.emit("number-shown", number);
};

const onPlay = (socket) => {
  dataBoards = dataBoards.map((dataBoard) => {
    if (dataBoard.clientId === socket.id) {
      dataBoard.playGame = true;
      return dataBoard;
    } else return dataBoard;
  });

  updatePlayers();

  const ready = dataBoards.reduce((accounter, dataBoard) => {
    if (dataBoard.playGame) accounter++;
    return accounter;
  }, 0);

  if (ready === dataBoards.length) {
    gameStarted = true;
    io.emit("game-started");

    generateNumberShown();
  }
};

const numberOnBoardValidation = (socket) => {
  let numberOnBoard = dataBoards.find(
    (dataBoard) =>
      dataBoard.clientId === socket.id &&
      dataBoard.board.split("-").includes(numberShown.toString())
  )
    ? true
    : false;

  return numberOnBoard;
};

const onDialCurrentNumberShown = (socket) => {
  if (numberOnBoardValidation(socket)) {
    dataBoards = dataBoards.map((dataBoard) => {
      if (dataBoard.clientId === socket.id) {
        dataBoard.markedCells = dataBoard.markedCells.includes(numberShown)
          ? dataBoard.markedCells
          : [...dataBoard.markedCells, numberShown];
        return dataBoard;
      } else return dataBoard;
    });
  }

  io.to(socket.id).emit(
    "dial-current-number-shown-response",
    numberOnBoardValidation(socket)
  );
};

const onNextNumber = (socket) => {
  dataBoards = dataBoards.map((dataBoard) => {
    if (dataBoard.clientId === socket.id) {
      dataBoard.nextNumber = true;
      return dataBoard;
    } else return dataBoard;
  });

  updatePlayers();

  const ready = dataBoards.reduce((accounter, dataBoard) => {
    if (dataBoard.nextNumber) accounter++;
    return accounter;
  }, 0);

  if (ready === dataBoards.length) {
    generateNumberShown();

    dataBoards = dataBoards.map((dataBoard) => {
      dataBoard.nextNumber = false;
      return dataBoard;
    });

    updatePlayers();
  }
};

const bingoOk = (dataBoard) => {
  const board = dataBoard.board.split("-");

  const NUM_COLUMNS_ROWS = 5;

  for (let i = 0; i < NUM_COLUMNS_ROWS; i++) {
    let accounter = 0;
    for (
      let j = i * NUM_COLUMNS_ROWS;
      j < NUM_COLUMNS_ROWS + i * NUM_COLUMNS_ROWS;
      j++
    ) {
      if (
        dataBoard.markedCells.includes(Number.parseInt(board[j])) ||
        Number.parseInt(board[j]) === 0
      )
        accounter++;
    }

    if (accounter === 5) return true;
  }

  for (let i = 0; i < NUM_COLUMNS_ROWS; i++) {
    let accounter = 0;
    for (
      let j = i, accounter_2 = 0;
      accounter_2 < NUM_COLUMNS_ROWS;
      j += NUM_COLUMNS_ROWS, accounter_2++
    ) {
      if (
        dataBoard.markedCells.includes(Number.parseInt(board[j])) ||
        Number.parseInt(board[j]) === 0
      )
        accounter++;
    }

    if (accounter === 5) return true;
  }

  let accounter = 0;
  for (
    let i = 0, accounter_2 = 0;
    accounter_2 < NUM_COLUMNS_ROWS;
    i += 6, accounter_2++
  ) {
    if (
      dataBoard.markedCells.includes(Number.parseInt(board[i])) ||
      Number.parseInt(board[i]) === 0
    )
      accounter++;
  }

  if (accounter === 5) return true;

  accounter = 0;
  for (
    let i = 4, accounter_2 = 0;
    accounter_2 < NUM_COLUMNS_ROWS;
    i += 4, accounter_2++
  ) {
    if (
      dataBoard.markedCells.includes(Number.parseInt(board[i])) ||
      Number.parseInt(board[i]) === 0
    )
      accounter++;
  }

  if (accounter === 5) return true;

  return dataBoard.markedCells.length === board.length - 1;
};

const reset = () => {
  dataBoards = [];
  numberShown = null;
  numbersShown = [];
  gameStarted = false;

  io.emit("reset");
};

const onBingo = (socket) => {
  const dataBoard = dataBoards.find(
    (dataBoard) => dataBoard.clientId === socket.id
  );

  if (bingoOk(dataBoard)) {
    dataBoards = dataBoards.map((dataBoard) => {
      dataBoard.playGame = false;
      dataBoard.nextNumber = false;
      if (dataBoard.clientId === socket.id) {
        dataBoard.winner = true;
        return dataBoard;
      } else return dataBoard;
    });

    io.to(socket.id).emit("winner");

    const dataB = dataBoards.find((dataBoard) => dataBoard.winner);

    io.emit("end-game", {
      boardW: dataB.board,
      markedCellsW: dataB.markedCells,
    });

    updatePlayers();

    setTimeout(() => {
      reset();
    }, 20000);
  }
};

const onDisconnect = (socket) => {
  dataBoards = dataBoards.filter(
    (dataBoard) => dataBoard.clientId !== socket.id
  );

  if (!dataBoards.length && gameStarted) reset();
  else if (dataBoards.length && gameStarted) updatePlayers();
};
