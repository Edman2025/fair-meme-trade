// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20VaultV3Like {
    function transferFrom(address from, address to, uint256 value) external returns (bool);
    function transfer(address to, uint256 value) external returns (bool);
}

contract LpLockVaultV3 {
    enum ReleaseType {
        OneTime,
        Linear
    }

    struct LockPosition {
        address owner;
        address lpToken;
        address projectToken;
        uint256 amount;
        uint256 unlockAt;
        uint256 withdrawn;
        uint256 createdAt;
        ReleaseType releaseType;
        uint256 releaseStart;
        uint256 releaseEnd;
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
        uint256 unlockAt,
        ReleaseType releaseType,
        uint256 releaseStart,
        uint256 releaseEnd
    );
    event LpWithdrawn(uint256 indexed positionId, address indexed owner, address indexed lpToken, uint256 amount);

    constructor() {
        owner = msg.sender;
    }

    function lock(
        address lpToken,
        address projectToken,
        uint256 amount,
        uint256 unlockAt,
        ReleaseType releaseType,
        uint256 releaseStart,
        uint256 releaseEnd
    ) external returns (uint256 positionId) {
        require(lpToken != address(0), "LP_REQUIRED");
        require(projectToken != address(0), "PROJECT_REQUIRED");
        require(amount > 0, "AMOUNT_REQUIRED");
        require(unlockAt > block.timestamp, "BAD_UNLOCK");

        if (releaseType == ReleaseType.Linear) {
            require(releaseStart >= unlockAt, "BAD_RELEASE_START");
            require(releaseEnd > releaseStart, "BAD_RELEASE_END");
        } else {
            releaseStart = unlockAt;
            releaseEnd = unlockAt;
        }

        bool ok = IERC20VaultV3Like(lpToken).transferFrom(msg.sender, address(this), amount);
        require(ok, "TRANSFER_FAILED");

        positionId = ++positionCount;
        positions[positionId] = LockPosition({
            owner: msg.sender,
            lpToken: lpToken,
            projectToken: projectToken,
            amount: amount,
            unlockAt: unlockAt,
            withdrawn: 0,
            createdAt: block.timestamp,
            releaseType: releaseType,
            releaseStart: releaseStart,
            releaseEnd: releaseEnd
        });
        positionsByOwner[msg.sender].push(positionId);

        emit LpLocked(positionId, msg.sender, lpToken, projectToken, amount, unlockAt, releaseType, releaseStart, releaseEnd);
    }

    function releasableAmount(uint256 positionId) public view returns (uint256) {
        LockPosition storage position = positions[positionId];
        if (position.owner == address(0) || block.timestamp < position.unlockAt) return 0;

        uint256 released;
        if (position.releaseType == ReleaseType.OneTime || block.timestamp >= position.releaseEnd) {
            released = position.amount;
        } else if (block.timestamp <= position.releaseStart) {
            released = 0;
        } else {
            released = position.amount * (block.timestamp - position.releaseStart) / (position.releaseEnd - position.releaseStart);
        }

        if (released <= position.withdrawn) return 0;
        return released - position.withdrawn;
    }

    function releaseAmount(uint256 positionId, uint256 amount) public {
        LockPosition storage position = positions[positionId];
        require(position.owner == msg.sender, "ONLY_OWNER");
        require(amount > 0, "AMOUNT_REQUIRED");

        uint256 withdrawable = releasableAmount(positionId);
        require(withdrawable >= amount, "INSUFFICIENT_RELEASED");
        position.withdrawn += amount;

        bool ok = IERC20VaultV3Like(position.lpToken).transfer(msg.sender, amount);
        require(ok, "TRANSFER_FAILED");

        emit LpWithdrawn(positionId, msg.sender, position.lpToken, amount);
    }

    function withdraw(uint256 positionId) external {
        uint256 withdrawable = releasableAmount(positionId);
        require(withdrawable > 0, "EMPTY");
        releaseAmount(positionId, withdrawable);
    }

    function getOwnerPositions(address account) external view returns (uint256[] memory) {
        return positionsByOwner[account];
    }
}
