// @ts-nocheck
interface Props {
    name: string;
    age?: number;
}

const ReactTsComponent = ({ name, age }: Props) => {
    return (
        <div>
            <h1>Hello, {name}!</h1>
            {age && <p>Age: {age}</p>}
        </div>
    );
};

export default ReactTsComponent;
