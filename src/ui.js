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
    }, 30);

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
const VehicleSelectionScreen = ({ onSelect, onBack, previewManager }) => {
  const vehicles = [
    { name: "Car", image: "assets/images/car.png" },
    { name: "Truck", image: "assets/images/truck.png" },
    { name: "Big_truck", image: "assets/images/big_truck.png" },
  ];

  const [currentIndex, setCurrentIndex] = useState(0);
  const [color, setColor] = useState("#ffdd00");
  const [textureFile, setTextureFile] = useState(null);
  const [textureName, setTextureName] = useState("");
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (previewManager) {
      previewManager.attach("vehicle-preview-canvas");
      const customization = textureFile
        ? { textureURL: URL.createObjectURL(textureFile) }
        : { color: color };
      previewManager.loadVehicle(vehicles[currentIndex].name, customization);
    }
    return () => {
      if (previewManager) {
        previewManager.detach();
      }
    };
  }, [previewManager]);

  useEffect(() => {
    if (previewManager) {
      const customization = textureFile
        ? { textureURL: URL.createObjectURL(textureFile) }
        : { color: color };
      previewManager.loadVehicle(vehicles[currentIndex].name, customization);
    }
  }, [currentIndex]);

  useEffect(() => {
    if (previewManager && !textureFile) {
      previewManager.applyCustomization({ color: color });
    }
  }, [color]);

  useEffect(() => {
    if (previewManager && textureFile) {
      const url = URL.createObjectURL(textureFile);
      previewManager.applyCustomization({ textureURL: url });
      return () => URL.revokeObjectURL(url);
    }
  }, [textureFile]);

  const handleNext = () =>
    setCurrentIndex((prev) => (prev + 1) % vehicles.length);
  const handlePrev = () =>
    setCurrentIndex((prev) => (prev - 1 + vehicles.length) % vehicles.length);

  const handleTextureUpload = (event) => {
    const file = event.target.files?.[0] || null;
    setTextureFile(file);
    setTextureName(file ? file.name : "");
  };

  const handleSelection = () => {
    onSelect({
      type: vehicles[currentIndex].name,
      image: vehicles[currentIndex].image,
      color: color,
      texture: textureFile ? URL.createObjectURL(textureFile) : null,
    });
  };

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
            <div id="vehicle-preview-canvas"></div>
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
  const KeyIcon = ({ children, isWide }) => (
    <div className={`key-icon ${isWide ? "key-icon-wide" : ""}`}>
      {children}
    </div>
  );

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
            <div className="control-row">
              <KeyIcon isWide={true}>SPACE</KeyIcon> - Brake
            </div>
          </div>
          <div className="control-group">
            <div className="control-row">
              <KeyIcon>B</KeyIcon> - Boost
            </div>
            <div className="control-row">
              <KeyIcon>H</KeyIcon> - Horn
            </div>
            <div className="control-row">
              <KeyIcon>O</KeyIcon> - Change Camera
            </div>
            <div className="control-row">
              <KeyIcon>V</KeyIcon> - View World
            </div>
            <div className="control-row">
              <KeyIcon>P</KeyIcon> - Debug Mode
            </div>
          </div>
          <div className="control-group">
            <div className="control-row">
              <KeyIcon>R</KeyIcon> - Reset Game
            </div>
            <div className="control-row">
              <KeyIcon>ESC</KeyIcon> - Exit to Menu
            </div>
          </div>
        </div>
      </div>
      <div className="button-group">
        <button className="game-button" onClick={onChangeVehicle}>
          CHANGE VEHICLE
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
  const previewManagerRef = useRef(null);

  // THÊM MỚI: State này sẽ hoạt động như một "key" để buộc component render lại
  const [previewKey, setPreviewKey] = useState(0);

  // useEffect để TẠO MỚI previewManager khi cần
  useEffect(() => {
    if (
      !previewManagerRef.current &&
      (gameState === "selectVehicle" || gameState === "loading")
    ) {
      if (window.VehiclePreviewManager) {
        console.log("Tạo mới thực thể VehiclePreviewManager.");
        previewManagerRef.current = new window.VehiclePreviewManager();
        // Cập nhật key để buộc re-render component con
        setPreviewKey((prevKey) => prevKey + 1);
      }
    }
  }, [gameState]);

  // useEffect để DỌN DẸP previewManager khi thoát game
  useEffect(() => {
    const handleExit = () => {
      // Bây giờ chúng ta sẽ chủ động dọn dẹp manager cũ
      if (previewManagerRef.current) {
        console.log("Dọn dẹp triệt để previewManager cũ để tạo lại.");
        previewManagerRef.current.cleanup();
        previewManagerRef.current = null;
      }
      // Sau khi dọn dẹp, chuyển về màn hình chọn xe.
      // Effect ở trên sẽ tự động tạo một manager mới.
      setGameState("selectVehicle");
    };

    window.addEventListener("exitToMenu", handleExit);
    return () => window.removeEventListener("exitToMenu", handleExit);
  }, []);

  // useEffect để quản lý ẩn/hiện UI và khởi động game
  useEffect(() => {
    const uiContainer = document.getElementById("ui-root");
    const gameContainer = document.getElementById("root-window");

    uiContainer.style.display = gameState === "inGame" ? "none" : "block";
    gameContainer.style.display = gameState === "inGame" ? "block" : "none";

    if (gameState === "inGame") {
      requestAnimationFrame(() => {
        if (window.startGame) {
          window.startGame(selectedVehicle);
        }
      });
    }
  }, [gameState, selectedVehicle]);

  const handleVehicleSelect = (vehicle) => {
    setSelectedVehicle(vehicle);
    setGameState("instructions");
  };

  const handleStartGame = () => {
    setGameState("inGame");
  };

  return (
    <React.Fragment>
      {gameState === "loading" && (
        <LoadingScreen onLoaded={() => setGameState("selectVehicle")} />
      )}
      {gameState === "selectVehicle" && (
        <VehicleSelectionScreen
          // THÊM MỚI: Dùng state `previewKey` làm key cho component
          key={previewKey}
          onSelect={handleVehicleSelect}
          onBack={() => setGameState("loading")}
          previewManager={previewManagerRef.current}
        />
      )}
      {gameState === "instructions" && (
        <InstructionsScreen
          vehicle={selectedVehicle}
          onPlay={handleStartGame}
          onChangeVehicle={() => setGameState("selectVehicle")}
        />
      )}
    </React.Fragment>
  );
};

const uiRoot = ReactDOM.createRoot(document.getElementById("ui-root"));
uiRoot.render(<App />);
