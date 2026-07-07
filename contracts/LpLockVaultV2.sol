// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20VaultLike {
    function transferFrom(address from, address to, uint256 value) external returns (bool);
    function transfer(address to, uint256 value) external returns (bool);
}

contract LpLockVaultV2 {
    struct LockPosition {
        address owner;
        address lpToken;
        address projectToken;
        uint256 amount;
        uint256 unlockAt;
        uint256 withdrawn;
        uint256 createdAt;
    }

    address public owner;
    uint256 public positionCount;
    mapping(uint256 => LockPosition) public positions;
    mapping(address => uint256[]) public positionsByOwner;

    event LpLocked(
        uint256 indexed positionId,
        address indexed owner,
        address indexed lpToken,
        address projectToken,
        uint256 amount,
        uint256 unlockAt
    );
    event LpWithdrawn(uint256 indexed positionId, address indexed owner, address indexed lpToken, uint256 amount);

    constructor() {
        owner = msg.sender;
    }

    function lock(address lpToken, address projectToken, uint256 amount, uint256 unlockAt) external returns (uint256 positionId) {
        require(lpToken != address(0), "LP_REQUIRED");
        require(projectToken != address(0), "PROJECT_REQUIRED");
        require(amount > 0, "AMOUNT_REQUIRED");
        require(unlockAt > block.timestamp, "BAD_UNLOCK");

        bool ok = IERC20VaultLike(lpToken).transferFrom(msg.sender, address(this), amount);
        require(ok, "TRANSFER_FAILED");

        positionId = ++positionCount;
        positions[positionId] = LockPosition({
            owner: msg.sender,
            lpToken: lpToken,
            projectToken: projectToken,
            amount: amount,
            unlockAt: unlockAt,
            withdrawn: 0,
            createdAt: block.timestamp
        });
        positionsByOwner[msg.sender].push(positionId);

        emit LpLocked(positionId, msg.sender, lpToken, projectToken, amount, unlockAt);
    }

    function withdraw(uint256 positionId) external {
        LockPosition storage position = positions[positionId];
        require(position.owner == msg.sender, "ONLY_OWNER");
        require(block.timestamp >= position.unlockAt, "LOCKED");

        uint256 withdrawable = position.amount - position.withdrawn;
        require(withdrawable > 0, "EMPTY");
        position.withdrawn = position.amount;

        bool ok = IERC20VaultLike(position.lpToken).transfer(msg.sender, withdrawable);
        require(ok, "TRANSFER_FAILED");

        emit LpWithdrawn(positionId, msg.sender, position.lpToken, withdrawable);
    }

    function getOwnerPositions(address account) external view returns (uint256[] memory) {
        return positionsByOwner[account];
    }
}
