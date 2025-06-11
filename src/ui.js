const { useState, useEffect, useRef } = React;

//================================================================
// Màn hình Loading
//================================================================
const LoadingScreen = ({ onLoaded }) => {
  const [progress, setProgress] = useState(0);
  const [loadingComplete, setLoadingComplete] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => setLoadingComplete(true), 300);
          return 100;
        }
        return prev + 1;
      });
    }, 45);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="screen loading-screen">
      <img src="assets/images/Logo.png" alt="Game Logo" className="logo" />

      {!loadingComplete ? (
        <div className="loading-container">
          <div className="loading-bar-background">
            <div
              className="loading-bar-foreground"
              style={{ width: `${progress}%` }}
            >
              <img
                src="assets/images/Icon.png"
                alt="Loading Icon"
                className="loading-icon"
              />
            </div>
          </div>
        </div>
      ) : (
        <button className="play-button" onClick={onLoaded}>
          PLAY
        </button>
      )}
    </div>
  );
};

//================================================================
// Màn hình Chọn Xe
//================================================================
const VehicleSelectionScreen = ({ onSelect, onBack }) => {
  // --- Đã thêm Big_truck vào đây ---
  const vehicles = [
    { name: "Car", image: "assets/images/car.png" },
    { name: "Truck", image: "assets/images/truck.png" },
    { name: "Big_truck", image: "assets/images/big_truck.png" },
  ];

  const [currentIndex, setCurrentIndex] = useState(0);
  const [color, setColor] = useState("#ffdd00");
  const [textureName, setTextureName] = useState("");
  const fileInputRef = useRef(null);

  const handleNext = () =>
    setCurrentIndex((prev) => (prev + 1) % vehicles.length);
  const handlePrev = () =>
    setCurrentIndex((prev) => (prev - 1 + vehicles.length) % vehicles.length);

  const handleTextureUpload = (event) => {
    if (event.target.files && event.target.files[0]) {
      setTextureName(event.target.files[0].name);
    } else {
      setTextureName("");
    }
  };

  const handleSelection = () => {
    onSelect({
      type: vehicles[currentIndex].name,
      image: vehicles[currentIndex].image,
      color: color,
      texture: fileInputRef.current.files[0]
        ? URL.createObjectURL(fileInputRef.current.files[0])
        : null,
    });
  };

  // Lấy tên xe hiện tại và thay thế dấu gạch dưới bằng khoảng trắng
  const currentVehicleName = vehicles[currentIndex].name.replace("_", " ");

  return (
    <div className="screen selection-screen">
      <h1 className="screen-title">CHOOSE YOUR VEHICLE</h1>
      <div className="selection-main">
        <div className="vehicle-display">
          <button className="arrow-button" onClick={handlePrev}>
            ‹
          </button>
          <div className="vehicle-image-container">
            <img
              src={vehicles[currentIndex].image}
              alt={vehicles[currentIndex].name}
              className="vehicle-image"
            />
            {/* --- THÊM DÒNG NÀY ĐỂ HIỂN THỊ TÊN XE --- */}
            <h2 className="vehicle-name">{currentVehicleName}</h2>
          </div>
          <button className="arrow-button" onClick={handleNext}>
            ›
          </button>
        </div>
        <div className="options-panel">
          <div className="option">
            <label htmlFor="color-picker">Vehicle Color:</label>
            <input
              type="color"
              id="color-picker"
              value={color}
              onChange={(e) => setColor(e.target.value)}
            />
          </div>
          <div className="option">
            <label>Custom Texture:</label>
            <button
              className="upload-button"
              onClick={() => fileInputRef.current.click()}
            >
              Upload Image
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleTextureUpload}
              style={{ display: "none" }}
              accept="image/*"
            />
            {textureName && <span className="texture-name">{textureName}</span>}
          </div>
          <img
            src="assets/images/cartoon-farmer.png"
            alt="Farmer"
            className="farmer-image"
          />
        </div>
      </div>
      <div className="button-group">
        <button className="game-button" onClick={onBack}>
          BACK
        </button>
        <button className="game-button primary" onClick={handleSelection}>
          SELECTION
        </button>
      </div>
    </div>
  );
};

//================================================================
// Màn hình Hướng Dẫn
//================================================================
const InstructionsScreen = ({ vehicle, onPlay, onChangeVehicle }) => {
  const vehicleImage = vehicle.image;

  const KeyIcon = ({ children }) => <div className="key-icon">{children}</div>;

  return (
    <div className="screen instructions-screen">
      <h1 className="screen-title">HOW TO PLAY</h1>
      <div className="instructions-main">
        <div className="instructions-vehicle-display">
          <img
            src={vehicleImage}
            alt={vehicle.type}
            className="vehicle-image-instructions"
          />
        </div>
        <div className="controls-panel">
          <div className="control-group">
            <div className="control-row">
              <KeyIcon>W</KeyIcon>/<KeyIcon>↑</KeyIcon> - Move Forward
            </div>
            <div className="control-row">
              <KeyIcon>S</KeyIcon>/<KeyIcon>↓</KeyIcon> - Move Backward
            </div>
            <div className="control-row">
              <KeyIcon>A</KeyIcon>/<KeyIcon>←</KeyIcon> - Turn Left
            </div>
            <div className="control-row">
              <KeyIcon>D</KeyIcon>/<KeyIcon>→</KeyIcon> - Turn Right
            </div>
          </div>
          <div className="control-group">
            <div className="control-row">
              <KeyIcon>R</KeyIcon> - Reset Game
            </div>
            <div className="control-row">
              <KeyIcon>H</KeyIcon> - Horn
            </div>
            <div className="control-row">
              <KeyIcon>O</KeyIcon> - Change Camera
            </div>
            <div className="control-row">
              <KeyIcon>P</KeyIcon> - Debug Mode
            </div>
            <div className="control-row">
              <KeyIcon>ESC</KeyIcon> - Exit to Menu
            </div>
          </div>
        </div>
      </div>
      <div className="button-group">
        <button className="game-button" onClick={onChangeVehicle}>
          Change Vehicle
        </button>
        <button className="game-button primary" onClick={onPlay}>
          PLAY
        </button>
      </div>
    </div>
  );
};

//================================================================
// Component App chính
//================================================================
const App = () => {
  const [gameState, setGameState] = useState("loading");
  const [selectedVehicle, setSelectedVehicle] = useState(null);

  useEffect(() => {
    const uiContainer = document.getElementById("ui-root");
    const gameContainer = document.getElementById("root-window");

    if (gameState === "inGame") {
      uiContainer.style.display = "none";
      gameContainer.style.display = "block";
    } else {
      uiContainer.style.display = "block";
      gameContainer.style.display = "none";
    }

    const handleExit = () => setGameState("selectVehicle");
    window.addEventListener("exitToMenu", handleExit);
    return () => window.removeEventListener("exitToMenu", handleExit);
  }, [gameState]);

  const handleVehicleSelect = (vehicle) => {
    setSelectedVehicle(vehicle);
    setGameState("instructions");
  };

  const handleStartGame = () => {
    if (window.startGame) {
      window.startGame(selectedVehicle);
    }
    setGameState("inGame");
  };

  return (
    <>
      {gameState === "loading" && (
        <LoadingScreen onLoaded={() => setGameState("selectVehicle")} />
      )}
      {gameState === "selectVehicle" && (
        <VehicleSelectionScreen
          onSelect={handleVehicleSelect}
          onBack={() => setGameState("loading")}
        />
      )}
      {gameState === "instructions" && (
        <InstructionsScreen
          vehicle={selectedVehicle}
          onPlay={handleStartGame}
          onChangeVehicle={() => setGameState("selectVehicle")}
        />
      )}
    </>
  );
};

const uiRoot = ReactDOM.createRoot(document.getElementById("ui-root"));
uiRoot.render(<App />);
