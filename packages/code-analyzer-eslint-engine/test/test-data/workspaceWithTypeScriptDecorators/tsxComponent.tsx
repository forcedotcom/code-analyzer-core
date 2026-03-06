// Simple TSX component for testing TypeScript parser
interface Props {
    title: string;
}

function TsxComponent(props: Props) {
    return props.title;
}

export default TsxComponent;
