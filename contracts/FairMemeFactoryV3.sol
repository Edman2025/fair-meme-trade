// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./FairMemeToken.sol";

contract FairMemeFactoryV3 {
    enum ProjectStatus {
        Building,
        Pending,
        Launched,
        Rejected
    }

    struct Project {
        address token;
        address creator;
        string name;
        string symbol;
        string metadataURI;
        address pairToken;
        uint256 totalSupply;
        uint256 createdAt;
        uint256 lpDeadline;
        ProjectStatus status;
    }

    address public owner;
    uint256 public projectCount;
    mapping(uint256 => Project) public projects;
    mapping(address => uint256) public projectIdByToken;
    mapping(address => bool) public admins;

    event AdminUpdated(address indexed admin, bool enabled);
    event TokenCreated(
        uint256 indexed projectId,
        address indexed token,
        address indexed creator,
        string name,
        string symbol,
        string metadataURI,
        address pairToken,
        uint256 totalSupply,
        uint256 lpDeadline
    );
    event ProjectReviewed(uint256 indexed projectId, address indexed reviewer, ProjectStatus status, string note);
    event ProjectLaunched(uint256 indexed projectId, address indexed reviewer);

    modifier onlyOwner() {
        require(msg.sender == owner, "ONLY_OWNER");
        _;
    }

    modifier onlyAdmin() {
        require(msg.sender == owner || admins[msg.sender], "ONLY_ADMIN");
        _;
    }

    constructor(address initialAdmin) {
        owner = msg.sender;
        if (initialAdmin != address(0)) {
            admins[initialAdmin] = true;
            emit AdminUpdated(initialAdmin, true);
        }
    }

    function setAdmin(address admin, bool enabled) external onlyOwner {
        admins[admin] = enabled;
        emit AdminUpdated(admin, enabled);
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
            name: name,
            symbol: symbol,
            metadataURI: metadataURI,
            pairToken: pairToken,
            totalSupply: totalSupply,
            createdAt: block.timestamp,
            lpDeadline: lpDeadline,
            status: ProjectStatus.Building
        });
        projectIdByToken[token] = projectId;

        emit TokenCreated(projectId, token, msg.sender, name, symbol, metadataURI, pairToken, totalSupply, lpDeadline);
    }

    function reviewProject(uint256 projectId, bool approved, string calldata note) external onlyAdmin {
        Project storage project = projects[projectId];
        require(project.token != address(0), "PROJECT_NOT_FOUND");
        project.status = approved ? ProjectStatus.Pending : ProjectStatus.Rejected;
        emit ProjectReviewed(projectId, msg.sender, project.status, note);
    }

    function markLaunched(uint256 projectId) external onlyAdmin {
        Project storage project = projects[projectId];
        require(project.token != address(0), "PROJECT_NOT_FOUND");
        require(project.status == ProjectStatus.Pending, "NOT_PENDING");
        project.status = ProjectStatus.Launched;
        emit ProjectLaunched(projectId, msg.sender);
    }
}
