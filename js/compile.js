import ethConnector from "ethconnector";
import path from "path";

ethConnector.compile(
    path.join(__dirname, "../contracts/MilestoneTracker.sol"),
    path.join(__dirname, "../contracts/MilestoneTracker.sol.js"),
    (err) => {
        if (err) {
            console.log(err);
            process.exit(1);
        } else {
            process.exit(0);
        }
    },
);
