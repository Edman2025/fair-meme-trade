// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./FairMemeToken.sol";

contract FairMemeFactory {
    enum TokenStatus {
        Building,
        Pending,
        Launched,
        Rejected
    }

    struct Project {
        address token;
        address creator;
        string metadataURI;
        address pairToken;
        uint256 createdAt;
        uint256 lpDeadline;
        TokenStatus status;
    }

    address public owner;
    uint256 public projectCount;
    mapping(uint256 => Project) public projects;
    mapping(address => uint256) public projectIdByToken;

    event TokenCreated(
        uint256 indexed projectId,
        address indexed token,
        address indexed creator,
        string symbol,
        string metadataURI
    );
    event ProjectReviewed(uint256 indexed projectId, TokenStatus status);
    event TradeRecorded(address indexed token, address indexed trader, bool isBuy, uint256 amountIn, uint256 amountOut);
    event LpAdded(address indexed token, address indexed provider, uint256 amount, address pairToken);

    modifier onlyOwner() {
        require(msg.sender == owner, "ONLY_OWNER");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function createToken(
        string calldata name,
        string calldata symbol,
        uint256 totalSupply,
        string calldata metadataURI,
        address pairToken,
        uint256 lpDeadline
    ) external returns (uint256 projectId, address token) {
        require(bytes(name).length > 0, "NAME_REQUIRED");
        require(bytes(symbol).length > 0, "SYMBOL_REQUIRED");
        require(totalSupply > 0, "SUPPLY_REQUIRED");
        require(lpDeadline > block.timestamp, "BAD_DEADLINE");

        FairMemeToken memeToken = new FairMemeToken(name, symbol, totalSupply, msg.sender);
        projectId = ++projectCount;
        token = address(memeToken);

        projects[projectId] = Project({
            token: token,
            creator: msg.sender,
            metadataURI: metadataURI,
            pairToken: pairToken,
            createdAt: block.timestamp,
            lpDeadline: lpDeadline,
            status: TokenStatus.Building
        });
        projectIdByToken[token] = projectId;

        emit TokenCreated(projectId, token, msg.sender, symbol, metadataURI);
    }

    function reviewProject(uint256 projectId, bool approved) external onlyOwner {
        Project storage project = projects[projectId];
        require(project.token != address(0), "PROJECT_NOT_FOUND");
        project.status = approved ? TokenStatus.Pending : TokenStatus.Rejected;
        emit ProjectReviewed(projectId, project.status);
    }

    function markLaunched(uint256 projectId) external onlyOwner {
        Project storage project = projects[projectId];
        require(project.token != address(0), "PROJECT_NOT_FOUND");
        require(project.status == TokenStatus.Pending, "NOT_PENDING");
        project.status = TokenStatus.Launched;
        emit ProjectReviewed(projectId, TokenStatus.Launched);
    }

    function recordTrade(address token, bool isBuy, uint256 amountIn, uint256 amountOut) external {
        require(projectIdByToken[token] != 0, "TOKEN_NOT_LISTED");
        emit TradeRecorded(token, msg.sender, isBuy, amountIn, amountOut);
    }

    function addLp(address token, uint256 amount) external {
        uint256 projectId = projectIdByToken[token];
        require(projectId != 0, "TOKEN_NOT_LISTED");
        emit LpAdded(token, msg.sender, amount, projects[projectId].pairToken);
    }
}
